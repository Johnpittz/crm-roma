"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Send, Check, User, MessageCircle, X, ArrowRightLeft, Paperclip, Mic, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Mensagem {
  id: string;
  remetente: string;
  conteudo: string;
  created_at: string;
  enviada_por?: string | null;
  url_audio?: string | null;
  tipo_midia?: string | null;
  url_midia?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  file_name?: string | null;
  whatsapp_message_id?: string | null;
}

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  status: string;
  ultima_mensagem?: string | null;
  ultima_mensagem_data?: string | null;
  ultima_mensagem_remetente?: string | null;
  nao_lido?: boolean;
  created_at?: string;
  cliente_id?: string | null;
  instance_name?: string | null;
  clientes?: { id: string; nome_razao_social: string; telefone?: string; celular?: string } | null;
}

interface ChatInlineProps {
  atendimento: Atendimento | null;
  onMarcarResolvido?: (id: string) => void;
  onMensagemEnviada?: () => void;
  onFechar?: () => void;
}

interface Vendedor {
  id: string;
  nome_completo: string;
  cargo: string;
}

export function ChatInline({ atendimento, onMarcarResolvido, onMensagemEnviada, onFechar }: ChatInlineProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [modoTransferencia, setModoTransferencia] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States para gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchMensagens = useCallback(async (silent = false) => {
    if (!atendimento) return;
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/atendimentos/mensagens?atendimento_id=${atendimento.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        let msgs = data.mensagens || [];
        
        // Se não há mensagens na tabela mas o atendimento tem ultima_mensagem (atendimentos antigos)
        if (msgs.length === 0 && atendimento.ultima_mensagem) {
          msgs = [{
            id: "virtual-" + atendimento.id,
            remetente: "cliente",
            conteudo: atendimento.ultima_mensagem,
            created_at: atendimento.ultima_mensagem_data || atendimento.created_at || new Date().toISOString(),
            enviada_por: null,
          }];
        }
        
        setMensagens(msgs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [atendimento, supabase]);

  // Busca vendedores para transferência
  const fetchVendedores = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/vendedores", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const todos = data.vendedores || [];
        const userId = session.user.id;
        const filtrados = todos.filter((v: Vendedor) => {
          const cargo = (v.cargo || "").toLowerCase().trim();
          const isVendedor = cargo === "vendedor" || cargo === "vendedora" || cargo === "gerente_comercial" || cargo === "admin" || cargo === "diretor";
          const temNome = v.nome_completo && v.nome_completo.trim().length > 0;
          const naoEU = v.id !== userId;
          return isVendedor && temNome && naoEU;
        });
        setVendedores(filtrados);
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    if (modoTransferencia) {
      fetchVendedores();
    }
  }, [modoTransferencia, fetchVendedores]);

  const transferirAtendimento = async (novoVendedorId: string) => {
    if (!atendimento || !novoVendedorId) return;
    setTransferindo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: atendimento.id, vendedor_id: novoVendedorId }),
      });

      if (res.ok) {
        setModoTransferencia(false);
        onMensagemEnviada?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTransferindo(false);
    }
  };

  // Marca como lido quando abre o chat
  const marcarComoLido = useCallback(async () => {
    if (!atendimento || !atendimento.nao_lido) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: atendimento.id, nao_lido: false }),
      });
    } catch (err) {
      console.error(err);
    }
  }, [atendimento, supabase]);

  // Reseta modo transferência quando muda de atendimento
  useEffect(() => {
    setModoTransferencia(false);
  }, [atendimento?.id]);

  useEffect(() => {
    if (atendimento) {
      fetchMensagens();
      marcarComoLido();
    }
  }, [atendimento, fetchMensagens, marcarComoLido]);

  // Scroll to bottom quando mensagens mudam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Polling: atualiza mensagens a cada 15s em background
  useEffect(() => {
    if (!atendimento) return;

    const interval = setInterval(() => {
      fetchMensagens(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [atendimento, fetchMensagens]);

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !atendimento) return;

    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos/mensagens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          atendimento_id: atendimento.id,
          conteudo: novaMensagem.trim(),
          remetente: "vendedor",
          instance: atendimento.instance_name,
        }),
      });

      if (res.ok) {
        setNovaMensagem("");
        fetchMensagens();
        onMensagemEnviada?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  // Enviar arquivo
  const enviarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !atendimento) return;

    setEnviando(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const isImage = file.type.startsWith("image/");
        const isAudio = file.type.startsWith("audio/");
        const isVideo = file.type.startsWith("video/");

        let mediatype = "document";
        if (isImage) mediatype = "image";
        else if (isAudio) mediatype = "audio";
        else if (isVideo) mediatype = "video";

        const res = await fetch("/api/send/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: atendimento.telefone_cliente,
            mediatype,
            mimetype: file.type,
            media: base64,
            fileName: file.name,
            instance: atendimento.instance_name,
          }),
        });

        if (res.ok) {
          const resDataArq = await res.json().catch(() => ({}));
          const mediaUrlArq = resDataArq.media_url || null;

          // Salvar no banco
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch("/api/atendimentos/mensagens", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                atendimento_id: atendimento.id,
                conteudo: `[${mediatype}]`,
                remetente: "vendedor",
                media_url: mediaUrlArq,
                media_type: mediatype,
                file_name: file.name,
              }),
            });
          }
          onMensagemEnviada?.();
        }
        setEnviando(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao enviar arquivo:", err);
      setEnviando(false);
    }
    // Limpar input
    e.target.value = "";
  };

  // Gravar áudio
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];

          if (atendimento) {
            try {
              const res = await fetch("/api/send/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  number: atendimento.telefone_cliente,
                  mediatype: "audio",
                  mimetype: "audio/ogg; codecs=opus",
                  media: base64,
                  instance: atendimento.instance_name,
                }),
              });

              if (res.ok) {
                const resData = await res.json().catch(() => ({}));
                const mediaUrlSalvo = resData.media_url || null;

                // Salvar no banco
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  await fetch("/api/atendimentos/mensagens", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      atendimento_id: atendimento.id,
                      conteudo: "[Áudio]",
                      remetente: "vendedor",
                      media_type: "audio",
                      media_url: mediaUrlSalvo,
                    }),
                  });
                }
                onMensagemEnviada?.();
              }
            } catch (err) {
              console.error("Erro ao enviar áudio:", err);
            }
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao iniciar gravação:", err);
    }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatarTempo = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatarHora = (data: string) => {
    const d = new Date(data);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Função para renderizar mídia
  const renderMidia = (msg: Mensagem) => {
    const mediaUrl = msg.url_midia || msg.media_url;
    const mediaType = msg.tipo_midia || msg.media_type;
    if (!mediaUrl && !mediaType) return null;

    const isWhatsAppCdn = mediaUrl?.includes("mmg.whatsapp.net");
    const isDataUrl = mediaUrl?.startsWith("data:");
    const isSupabaseStorage = mediaUrl?.includes("supabase.co/storage");

    let resolvedUrl: string | null = null;
    if (isWhatsAppCdn && msg.id && !msg.id.startsWith("virtual-")) {
      resolvedUrl = `/api/media-download?msg_id=${msg.id}&type=${mediaType || "image"}`;
    } else if (isDataUrl || isSupabaseStorage) {
      resolvedUrl = mediaUrl!;
    } else if (mediaUrl) {
      resolvedUrl = `/api/media?url=${encodeURIComponent(mediaUrl)}&type=${mediaType || "image"}`;
    }

    // Normalizar tipos PT -> EN para o switch
    const tipoNormalizado = mediaType === "imagem" ? "image"
      : mediaType === "documento" ? "document"
      : mediaType;

    switch (tipoNormalizado) {
      case "image":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return <img src={resolvedUrl} alt="Imagem" className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90" onClick={() => window.open(resolvedUrl!, "_blank")} />;
        }
        return <div className="flex items-center gap-2 text-slate-500 text-xs"><span className="text-lg">🖼️</span>Imagem recebida</div>;
      case "audio": {
        const audioUrl = msg.id && !msg.id.startsWith("virtual-") && isWhatsAppCdn
          ? `/api/media-download?msg_id=${msg.id}&type=audio`
          : resolvedUrl;
        if (audioUrl && !audioUrl.includes("[media_proxy_needed]")) {
          return (
            <div className="flex items-center gap-2 min-w-[180px]">
              <span className="text-lg">🎵</span>
              <audio controls preload="metadata" className="h-8 flex-1">
                <source src={audioUrl} />
              </audio>
            </div>
          );
        }
        return <div className="flex items-center gap-2 text-slate-500 text-xs"><span className="text-lg">🎵</span>Áudio recebido</div>;
      }
      case "video":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return <video src={resolvedUrl} controls className="max-w-[250px] rounded-lg" />;
        }
        return <div className="flex items-center gap-2 text-slate-500 text-xs"><span className="text-lg">🎬</span>Vídeo recebido</div>;
      case "document":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return (
            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
              <span className="text-2xl">📄</span>
              <span className="text-sm truncate">{msg.file_name || "Documento"}</span>
            </a>
          );
        }
        return <div className="flex items-center gap-2 text-slate-500 text-xs"><span className="text-lg">📄</span>{msg.file_name || "Documento recebido"}</div>;
      case "sticker":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return <img src={resolvedUrl} alt="Sticker" className="max-h-32" />;
        }
        return <div className="text-slate-500 text-xs">📎 Figurinha</div>;
      default:
        return null;
    }
  };

  // Se nenhum atendimento selecionado, mostra placeholder
  if (!atendimento) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-50/50">
        <MessageCircle className="h-16 w-16 opacity-20" />
        <p className="text-sm">Selecione uma conversa para iniciar</p>
      </div>
    );
  }

  const nomeCliente = atendimento?.clientes?.nome_razao_social || atendimento?.nome_cliente || "Cliente";
  const telefone = atendimento?.clientes?.telefone || atendimento?.clientes?.celular || atendimento?.telefone_cliente || "";

  return (
    <div className="h-full flex flex-col">
      {/* Header do Chat — simplificado (nome + telefone + ações) */}
      <div className="shrink-0 px-4 py-2.5 border-b border-slate-200 bg-white">
        {modoTransferencia ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setModoTransferencia(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-slate-700">Transferir para:</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs shrink-0">
                {nomeCliente.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{nomeCliente}</h3>
                <span className="text-[11px] text-slate-500">{telefone}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setModoTransferencia(true)}
                title="Transferir atendimento"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
              {onFechar && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-slate-400 hover:text-slate-600"
                  onClick={onFechar}
                  title="Fechar chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Conteudo: mensagens OU transferencia */}
      {modoTransferencia ? (
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {vendedores.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Carregando vendedores...
            </div>
          ) : (
            <div className="space-y-1">
              {vendedores.map((v) => (
                <button
                  key={v.id}
                  disabled={transferindo}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-green-50 text-left transition-colors disabled:opacity-50 border border-transparent hover:border-green-200"
                  onClick={() => transferirAtendimento(v.id)}
                >
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                    {v.nome_completo.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{v.nome_completo}</p>
                    <p className="text-xs text-slate-400">Clique para transferir</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Área de mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Carregando mensagens...
              </div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
                <MessageCircle className="h-8 w-8 opacity-40" />
                <p>Nenhuma mensagem ainda</p>
              </div>
            ) : (
              mensagens.map((msg) => {
                const isCliente = msg.remetente === "cliente";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      isCliente ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        isCliente
                          ? "bg-green-600 text-white rounded-br-sm"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                      )}
                    >
                      {/* Renderizar mídia ou texto */}
                      {renderMidia(msg) || (
                        <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                      )}
                      <span
                        className={cn(
                          "text-[10px] mt-1 block text-right",
                          isCliente ? "text-green-200" : "text-slate-400"
                        )}
                      >
                        {formatarHora(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 shrink-0 bg-white">
            {isRecording ? (
              // Modo gravação
              <div className="flex items-center gap-3">
                <span className="text-red-500 animate-pulse text-lg">🔴</span>
                <span className="text-sm font-medium text-slate-700">{formatarTempo(recordingTime)}</span>
                <Button
                  type="button"
                  onClick={pararGravacao}
                  size="icon"
                  className="h-9 w-9 bg-red-600 hover:bg-red-700 shrink-0"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              // Modo input normal
              <form onSubmit={enviarMensagem} className="flex items-center gap-2">
                {/* Input de arquivo oculto */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
                  onChange={enviarArquivo}
                />
                {/* Botão de arquivo */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviando}
                  title="Enviar arquivo"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Botão de gravação */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  onClick={iniciarGravacao}
                  disabled={enviando}
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </Button>

                {/* Input de texto */}
                <Input
                  placeholder="Digite sua resposta..."
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  className="flex-1"
                  disabled={enviando}
                />

                {/* Botão enviar */}
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 bg-green-600 hover:bg-green-700 shrink-0"
                  disabled={enviando || !novaMensagem.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
