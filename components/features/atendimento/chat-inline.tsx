"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Send, Check, CheckCheck, User, MessageCircle, X,
  ArrowRightLeft, Paperclip, Mic, Square, Smile, MoreVertical,
  Search, Image as ImageIcon, FileText, Play, Pause,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────

/** Formata hora: "14:30" */
const formatarHora = (data: string) => {
  const d = new Date(data);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

/** Formata timer de gravação: "1:05" */
const formatarTempo = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/** Separador de data: "HOJE", "ONTEM", ou "21/09/2026" */
const formatarDataSeparador = (data: string) => {
  const d = new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const isMesmoDia = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  if (isMesmoDia(d, hoje)) return "HOJE";
  if (isMesmoDia(d, ontem)) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Verifica se duas datas são de dias diferentes */
const diasDiferentes = (a: string, b: string) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.getDate() !== db.getDate() || da.getMonth() !== db.getMonth() || da.getFullYear() !== db.getFullYear();
};

/** Normaliza tipo de mídia PT → EN */
const normalizarTipoMidia = (tipo: string | null | undefined): string => {
  if (!tipo) return "unknown";
  const map: Record<string, string> = {
    imagem: "image", áudio: "audio", audio: "audio",
    vídeo: "video", video: "video", documento: "document",
    document: "document", figurinha: "sticker", sticker: "sticker",
  };
  return map[tipo.toLowerCase()] || tipo;
};

// ─── Component ───────────────────────────────────────────────────

export function ChatInline({ atendimento, onMarcarResolvido, onMensagemEnviada, onFechar }: ChatInlineProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [modoTransferencia, setModoTransferencia] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States para gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── Fetch Mensagens ──
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

        // Fallback: se não há mensagens na tabela mas o atendimento tem ultima_mensagem
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

  // ── Fetch Vendedores (transferência) ──
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
    if (modoTransferencia) fetchVendedores();
  }, [modoTransferencia, fetchVendedores]);

  // ── Transferir Atendimento ──
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

  // ── Marcar como Lido ──
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

  // Reset transferência ao mudar de atendimento
  useEffect(() => {
    setModoTransferencia(false);
  }, [atendimento?.id]);

  // Carregar mensagens ao mudar de atendimento
  useEffect(() => {
    if (atendimento) {
      fetchMensagens();
      marcarComoLido();
    }
  }, [atendimento, fetchMensagens, marcarComoLido]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  // ── Polling 15s ──
  useEffect(() => {
    if (!atendimento) return;
    const interval = setInterval(() => fetchMensagens(true), 15000);
    return () => clearInterval(interval);
  }, [atendimento, fetchMensagens]);

  // ── Enviar Texto ──
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

  // ── Enviar Arquivo ──
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
          fetchMensagens();
          onMensagemEnviada?.();
        }
        setEnviando(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao enviar arquivo:", err);
      setEnviando(false);
    }
    e.target.value = "";
  };

  // ── Gravar Áudio ──
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
                fetchMensagens();
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
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  // ── Renderizar Mídia ──
  const renderMidia = (msg: Mensagem) => {
    const mediaUrl = msg.url_midia || msg.media_url;
    const mediaType = normalizarTipoMidia(msg.tipo_midia || msg.media_type);

    if (!mediaUrl && mediaType === "unknown") return null;

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

    switch (mediaType) {
      case "image":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return (
            <div className="relative max-w-[330px]">
              <img
                src={resolvedUrl}
                alt="Imagem"
                className="rounded-lg cursor-pointer hover:brightness-90 transition-all"
                onClick={() => window.open(resolvedUrl!, "_blank")}
                loading="lazy"
              />
              {msg.conteudo && msg.conteudo !== `[${msg.tipo_midia || msg.media_type}]` && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg">
                  <p className="text-white text-xs">{msg.conteudo}</p>
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-[#667781] text-xs">
            <ImageIcon className="h-4 w-4" /> Imagem recebida
          </div>
        );

      case "audio": {
        const audioUrl = msg.id && !msg.id.startsWith("virtual-") && isWhatsAppCdn
          ? `/api/media-download?msg_id=${msg.id}&type=audio`
          : resolvedUrl;
        if (audioUrl && !audioUrl.includes("[media_proxy_needed]")) {
          return <AudioPlayer url={audioUrl} isCliente={msg.remetente === "cliente"} />;
        }
        return (
          <div className="flex items-center gap-2 text-[#667781] text-xs">
            <span>🎵</span> Áudio recebido
          </div>
        );
      }

      case "video":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return (
            <div className="max-w-[330px]">
              <video
                src={resolvedUrl}
                controls
                className="rounded-lg"
                preload="metadata"
              />
              {msg.conteudo && msg.conteudo !== `[${msg.tipo_midia || msg.media_type}]` && (
                <p className="text-xs mt-1 whitespace-pre-wrap break-words">{msg.conteudo}</p>
              )}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-[#667781] text-xs">
            <span>🎬</span> Vídeo recebido
          </div>
        );

      case "document":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 transition-colors"
            >
              <div className="h-10 w-10 rounded bg-[#5F66CD] flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{msg.file_name || "Documento"}</p>
                <p className="text-[11px] text-[#667781]">Documento</p>
              </div>
            </a>
          );
        }
        return (
          <div className="flex items-center gap-2 text-[#667781] text-xs">
            <FileText className="h-4 w-4" /> {msg.file_name || "Documento recebido"}
          </div>
        );

      case "sticker":
        if (resolvedUrl && !resolvedUrl.includes("[media_proxy_needed]")) {
          return <img src={resolvedUrl} alt="Sticker" className="max-h-32" />;
        }
        return <div className="text-[#667781] text-xs">📎 Figurinha</div>;

      default:
        return null;
    }
  };

  // ── Placeholder quando nenhum atendimento ──
  if (!atendimento) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#667781] gap-3 bg-[#f0f2f5]">
        <MessageCircle className="h-16 w-16 opacity-20" />
        <p className="text-sm">Selecione uma conversa para iniciar</p>
      </div>
    );
  }

  const nomeCliente = atendimento?.clientes?.nome_razao_social || atendimento?.nome_cliente || "Cliente";
  const telefone = atendimento?.clientes?.telefone || atendimento?.clientes?.celular || atendimento?.telefone_cliente || "";

  return (
    <div className="h-full flex flex-col">
      {/* ─── HEADER WHATSAPP ─── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-[#f0f2f5] border-b border-[#e9edef]">
        {modoTransferencia ? (
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-black/5"
              onClick={() => setModoTransferencia(false)}
            >
              <X className="h-4 w-4 text-[#54656f]" />
            </Button>
            <span className="text-sm font-medium text-[#111b21]">Transferir para:</span>
          </div>
        ) : (
          <>
            {/* Avatar + Info */}
            <div className="h-10 w-10 rounded-full bg-[#dfe5e7] flex items-center justify-center text-[#667781] font-medium text-sm shrink-0">
              {nomeCliente.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-normal text-[#111b21] truncate">{nomeCliente}</h3>
              <span className="text-[13px] text-[#667781]">{telefone}</span>
            </div>

            {/* Ações do header */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 rounded-full hover:bg-black/5"
                onClick={() => setModoTransferencia(true)}
                title="Transferir atendimento"
              >
                <ArrowRightLeft className="h-5 w-5 text-[#54656f]" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 rounded-full hover:bg-black/5"
                title="Buscar"
              >
                <Search className="h-5 w-5 text-[#54656f]" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 rounded-full hover:bg-black/5"
                title="Mais opções"
              >
                <MoreVertical className="h-5 w-5 text-[#54656f]" />
              </Button>
              {onFechar && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 rounded-full hover:bg-black/5"
                  onClick={onFechar}
                  title="Fechar chat"
                >
                  <X className="h-5 w-5 text-[#54656f]" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── CONTEÚDO: Mensagens OU Transferência ─── */}
      {modoTransferencia ? (
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {vendedores.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#667781] text-sm">
              Carregando vendedores...
            </div>
          ) : (
            <div className="space-y-1">
              {vendedores.map((v) => (
                <button
                  key={v.id}
                  disabled={transferindo}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#f0f2f5] text-left transition-colors disabled:opacity-50 border border-transparent hover:border-[#e9edef]"
                  onClick={() => transferirAtendimento(v.id)}
                >
                  <div className="h-10 w-10 rounded-full bg-[#dfe5e7] flex items-center justify-center text-sm font-medium text-[#667781]">
                    {v.nome_completo.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-normal text-[#111b21]">{v.nome_completo}</p>
                    <p className="text-xs text-[#667781]">Clique para transferir</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ─── ÁREA DE MENSAGENS ─── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-[5%] py-3 bg-[#efeae2] min-h-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d5db' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#667781] text-sm gap-2">
                <MessageCircle className="h-8 w-8 opacity-40" />
                <p>Nenhuma mensagem ainda</p>
              </div>
            ) : (
              mensagens.map((msg, idx) => {
                const isCliente = msg.remetente === "cliente";
                const isSistema = msg.remetente === "sistema";

                // ── Separador de Data ──
                const mostrarSeparador = idx === 0 || diasDiferentes(msg.created_at, mensagens[idx - 1].created_at);

                return (
                  <div key={msg.id}>
                    {/* Separador de data */}
                    {mostrarSeparador && (
                      <div className="flex justify-center my-3">
                        <span className="bg-[#e2dccc] text-[#54656f] text-[12.5px] py-[6px] px-[12px] rounded-lg shadow-sm font-medium">
                          {formatarDataSeparador(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Mensagem */}
                    {isSistema ? (
                      <div className="flex justify-center my-1">
                        <span className="bg-[#e2dccc] text-[#54656f] text-[12.5px] py-[5px] px-[12px] rounded-lg shadow-sm">
                          {msg.conteudo}
                        </span>
                      </div>
                    ) : (
                      <div className={cn("flex mb-[2px]", isCliente ? "justify-start" : "justify-end")}>
                        <div
                          className={cn(
                            "relative max-w-[65%] rounded-lg px-[9px] pt-[6px] pb-[8px] text-[14.2px] leading-[19px] shadow-sm group",
                            isCliente
                              ? "bg-white text-[#111b21] rounded-tl-none"
                              : "bg-[#D9FDD3] text-[#111b21] rounded-tr-none"
                          )}
                        >
                          {/* Mídia ou Texto */}
                          {renderMidia(msg) || (
                            <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                          )}

                          {/* Timestamp + Checkmark */}
                          <div className="flex items-center justify-end gap-[3px] mt-[2px] -mb-[2px]">
                            <span className="text-[11px] text-[#667781] select-none">
                              {formatarHora(msg.created_at)}
                            </span>
                            {!isCliente && (
                              <CheckCheck className="h-[14px] w-[14px] text-[#53bdeb] shrink-0" />
                            )}
                          </div>

                          {/* Hover Actions (reply + reaction) */}
                          <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="flex items-center gap-[2px] bg-white rounded-md shadow-md px-1 py-[2px]">
                              <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-black/5 text-[#54656f] text-sm">
                                😊
                              </button>
                              <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-black/5 text-[#54656f]">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 17l-5-5 5-5M15 7l5 5-5 5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Indicador digitando */}
            {enviando && (
              <div className="flex justify-end mb-[2px]">
                <div className="bg-[#D9FDD3] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── INPUT WHATSAPP ─── */}
          <div className="shrink-0 px-3 py-[10px] bg-[#f0f2f5] border-t border-[#e9edef]">
            {isRecording ? (
              // ── Modo Gravação ──
              <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2">
                <span className="text-red-500 animate-pulse text-lg">🔴</span>
                <span className="text-sm font-medium text-[#111b21]">{formatarTempo(recordingTime)}</span>
                <div className="flex-1" />
                <Button
                  type="button"
                  onClick={pararGravacao}
                  size="icon"
                  className="h-9 w-9 bg-red-600 hover:bg-red-700 rounded-full shrink-0"
                >
                  <Square className="h-4 w-4 text-white" />
                </Button>
              </div>
            ) : (
              // ── Modo Input Normal ──
              <form onSubmit={enviarMensagem} className="flex items-center gap-[6px]">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
                  onChange={enviarArquivo}
                />

                {/* Botão Emoji */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-[42px] w-[42px] shrink-0 rounded-full hover:bg-black/5 text-[#54656f]"
                  title="Emoji"
                >
                  <Smile className="h-6 w-6" />
                </Button>

                {/* Botão Arquivo */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-[42px] w-[42px] shrink-0 rounded-full hover:bg-black/5 text-[#54656f]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviando}
                  title="Anexar arquivo"
                >
                  <Paperclip className="h-6 w-6" />
                </Button>

                {/* Input de Texto */}
                <div className="flex-1 bg-white rounded-full px-4 py-[9px]">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Digite uma mensagem"
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    className="w-full bg-transparent text-[15px] text-[#111b21] placeholder:text-[#667781] outline-none"
                    disabled={enviando}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviarMensagem(e as any);
                      }
                    }}
                  />
                </div>

                {/* Botão Mic ou Send */}
                {novaMensagem.trim() ? (
                  <Button
                    type="submit"
                    size="icon"
                    className="h-[42px] w-[42px] bg-[#00a884] hover:bg-[#009172] rounded-full shrink-0"
                    disabled={enviando || !novaMensagem.trim()}
                  >
                    <Send className="h-5 w-5 text-white" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-[42px] w-[42px] shrink-0 rounded-full hover:bg-black/5 text-[#54656f]"
                    onClick={iniciarGravacao}
                    disabled={enviando}
                    title="Mensagem de voz"
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                )}
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Audio Player WhatsApp-Style ─────────────────────────────────

function AudioPlayer({ url, isCliente }: { url: string; isCliente: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setProgress(0); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const formatarDuracao = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 min-w-[250px]",
      isCliente ? "" : ""
    )}>
      <audio ref={audioRef} preload="metadata">
        <source src={url} />
      </audio>

      <button
        onClick={togglePlay}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isCliente
            ? "bg-[#00a884] hover:bg-[#009172] text-white"
            : "bg-[#00a884] hover:bg-[#009172] text-white"
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-[2px]" />}
      </button>

      <div className="flex-1 flex flex-col gap-[3px]">
        {/* Barra de progresso */}
        <div className="h-[3px] bg-[#d1d7db] rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !audio.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = x / rect.width;
            audio.currentTime = pct * audio.duration;
          }}
        >
          <div
            className="h-full bg-[#00a884] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] text-[#667781]">
          {playing ? formatarDuracao(audioRef.current?.currentTime || 0) : formatarDuracao(duration || 0)}
        </span>
      </div>
    </div>
  );
}
