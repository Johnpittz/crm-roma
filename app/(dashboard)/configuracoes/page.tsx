"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Shield,
  Palette,
  Save,
  Camera,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConectarWhatsApp } from "@/components/features/configuracoes/conectar-whatsapp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cargo: string | null;
  avatar_url: string | null;
}

function AparenciaContent() {
  const { compact, setCompact, animations, setAnimations } = useTheme();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Comportamento</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Modo Compacto</p>
            <p className="text-sm text-slate-500">Reduzir espaçamentos na interface</p>
          </div>
          <Switch checked={compact} onCheckedChange={setCompact} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Animações</p>
            <p className="text-sm text-slate-500">Ativar animações de transição</p>
          </div>
          <Switch checked={animations} onCheckedChange={setAnimations} />
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isGestor, setIsGestor] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    whatsapp: "",
  });

  // Preferências de notificações
  const [notifPrefs, setNotifPrefs] = useState({
    canal_push: true,
    notif_atendimentos: true,
    notif_tarefas: true,
    notif_oportunidades: true,
    notif_metas_campanhas: true,
    notif_prospeccao: true,
    som_ativado: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  // Estados para Segurança
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);

  const cargosGerencia = ["diretor", "gerente_comercial", "admin"];

  // Busca preferências de notificações (direto do Supabase)
  useEffect(() => {
    async function fetchNotifPrefs() {
      setNotifLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("preferencias_notificacoes")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Erro ao buscar prefs:", error);
          return;
        }

        if (data) {
          setNotifPrefs({
            canal_push: data.canal_push ?? true,
            notif_atendimentos: data.notif_atendimentos ?? true,
            notif_tarefas: data.notif_tarefas ?? true,
            notif_oportunidades: data.notif_oportunidades ?? true,
            notif_metas_campanhas: data.notif_metas_campanhas ?? true,
            notif_prospeccao: data.notif_prospeccao ?? true,
            som_ativado: data.som_ativado ?? true,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setNotifLoading(false);
      }
    }
    fetchNotifPrefs();
  }, [supabase]);

  const handleNotifToggle = (key: string) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const handleSaveNotifPrefs = async () => {
    setNotifSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada.");
        return;
      }

      const { error } = await supabase
        .from("preferencias_notificacoes")
        .upsert({
          user_id: user.id,
          canal_push: notifPrefs.canal_push,
          som_ativado: notifPrefs.som_ativado,
          notif_atendimentos: notifPrefs.notif_atendimentos,
          notif_tarefas: notifPrefs.notif_tarefas,
          notif_oportunidades: notifPrefs.notif_oportunidades,
          notif_metas_campanhas: notifPrefs.notif_metas_campanhas,
          notif_prospeccao: notifPrefs.notif_prospeccao,
        }, { onConflict: "user_id" });

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
      } else {
        toast.success("Preferências de notificação salvas!");
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + (err?.message || "desconhecido"));
    } finally {
      setNotifSaving(false);
    }
  };

  // Busca perfil do usuário logado
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          toast.error("Usuário não autenticado.");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, nome_completo, email, telefone, whatsapp, cargo, avatar_url")
          .eq("id", user.id)
          .single();

        if (profileError) {
          toast.error("Não foi possível carregar seu perfil.");
          return;
        }

        setProfile(profileData);
        setIsGestor(profileData?.cargo ? cargosGerencia.includes(profileData.cargo) : false);
        setFormData({
          nome_completo: profileData?.nome_completo || user.email?.split("@")[0] || "",
          email: user.email || "",
          telefone: profileData?.telefone || "",
          whatsapp: profileData?.whatsapp || "",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [supabase, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      // Atualiza email no Auth se mudou
      const { data: { user } } = await supabase.auth.getUser();
      if (user && formData.email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email,
        });
        if (authError) {
          toast.error(`Erro no e-mail: ${authError.message}`);
          setSaving(false);
          return;
        }
      }

      // Atualiza perfil no banco
      const { error } = await supabase
        .from("profiles")
        .update({
          nome_completo: formData.nome_completo,
          telefone: formData.telefone,
          whatsapp: formData.whatsapp,
          email: formData.email,
        })
        .eq("id", profile.id);

      if (error) {
        toast.error("Não foi possível salvar as alterações.");
      } else {
        toast.success("Perfil atualizado com sucesso!");
      }
    } catch {
      toast.error("Erro inesperado ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validações
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Use JPG, PNG, GIF ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Máximo 2MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error(`Erro no upload: ${uploadError.message}`);
        return;
      }

      // Pega URL pública
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Atualiza perfil com nova URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) {
        toast.error("Foto enviada, mas não foi possível atualizar perfil.");
        return;
      }

      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      toast.success("Foto de perfil atualizada!");
    } catch {
      toast.error("Erro inesperado no upload.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const avatarFallback = profile?.nome_completo
    ? profile.nome_completo.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile?.email?.charAt(0).toUpperCase() || "U";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#14919B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          {isGestor && <TabsTrigger value="integracoes">Integrações</TabsTrigger>}
          {isGestor && <TabsTrigger value="equipe">Equipe</TabsTrigger>}
        </TabsList>

        {/* Perfil */}
        <TabsContent value="perfil" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais e dados de contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-[#14919B] text-white">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handlePhotoClick}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {uploadingPhoto ? "Enviando..." : "Alterar Foto"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <p className="text-xs text-slate-500">
                    JPG, PNG, GIF ou WEBP. Máximo 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_completo">Nome Completo</Label>
                  <Input
                    id="nome_completo"
                    value={formData.nome_completo}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    placeholder="(11) 98765-4321"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    placeholder="5511987654321"
                  />
                </div>
              </div>

              <Separator />

              {/* Canal */}
              <div className="space-y-2">
                <Label htmlFor="canal">Canal Principal</Label>
              <Input
                id="canal"
                value={profile?.cargo ? (() => {
                    switch (profile.cargo) {
                      case "diretor": return "Diretoria";
                      case "gerente_comercial": return "Gerência Comercial";
                      case "admin": return "Administração";
                      case "demonstracao": return "Demonstração";
                      default: return "Loja / Comercial";
                    }
                  })() : "Loja / Comercial"}
                  disabled
                />
                <p className="text-xs text-slate-500">
                  Para alterar o canal/cargo, entre em contato com o administrador.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Escolha como deseja receber as notificações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {notifLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#14919B]" />
                </div>
              ) : (
                <>
                  {/* Canais */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-900">Canais</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Push no Navegador</p>
                        <p className="text-sm text-slate-500">Toasts e badge no sininho em tempo real</p>
                      </div>
                      <Switch
                        checked={notifPrefs.canal_push}
                        onCheckedChange={() => handleNotifToggle("canal_push")}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Som */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Som de Notificação</p>
                      <p className="text-sm text-slate-500">Tocar alerta sonoro quando chegar notificação</p>
                    </div>
                    <Switch
                      checked={notifPrefs.som_ativado}
                      onCheckedChange={() => handleNotifToggle("som_ativado")}
                    />
                  </div>

                  <Separator />

                  {/* Tipos */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-900">Tipos de Notificação</h3>
                    {[
                      { key: "notif_atendimentos", label: "Atendimentos", desc: "Novos atendimentos, transferências e mensagens" },
                      { key: "notif_tarefas", label: "Tarefas", desc: "Lembretes de tarefas agendadas" },
                      { key: "notif_oportunidades", label: "Oportunidades", desc: "Novas oportunidades de venda" },
                      { key: "notif_metas_campanhas", label: "Metas e Campanhas", desc: "Alertas sobre metas e campanhas ativas" },
                      { key: "notif_prospeccao", label: "Prospecção B2B", desc: "Leads atribuídos via prospecção" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-medium text-slate-900">{item.label}</p>
                          <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[item.key as keyof typeof notifPrefs] as boolean}
                          onCheckedChange={() => handleNotifToggle(item.key)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveNotifPrefs} disabled={notifSaving} className="gap-2">
                      {notifSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {notifSaving ? "Salvando..." : "Salvar Preferências"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="seguranca" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Segurança da Conta</CardTitle>
              <CardDescription>
                Gerencie sua senha e controle de acesso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Alterar Senha */}
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Alterar Senha</h3>
                <div className="space-y-2">
                  <Label htmlFor="senha-atual">Senha Atual</Label>
                  <Input
                    id="senha-atual"
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="Digite sua senha atual"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova Senha</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmar-senha"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!senhaAtual || !novaSenha || !confirmarSenha) {
                      toast.error("Preencha todos os campos.");
                      return;
                    }
                    if (novaSenha.length < 6) {
                      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
                      return;
                    }
                    if (novaSenha !== confirmarSenha) {
                      toast.error("As senhas não coincidem.");
                      return;
                    }
                    setAlterandoSenha(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user?.email) {
                        toast.error("E-mail não encontrado.");
                        return;
                      }
                      // Verifica senha atual
                      const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: user.email,
                        password: senhaAtual,
                      });
                      if (signInError) {
                        toast.error("Senha atual incorreta.");
                        return;
                      }
                      // Atualiza senha
                      const { error: updateError } = await supabase.auth.updateUser({
                        password: novaSenha,
                      });
                      if (updateError) {
                        toast.error("Erro ao atualizar senha: " + updateError.message);
                        return;
                      }
                      toast.success("Senha atualizada com sucesso!");
                      setSenhaAtual("");
                      setNovaSenha("");
                      setConfirmarSenha("");
                    } catch (err: any) {
                      toast.error("Erro inesperado: " + (err?.message || "desconhecido"));
                    } finally {
                      setAlterandoSenha(false);
                    }
                  }}
                  disabled={alterandoSenha}
                >
                  {alterandoSenha ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {alterandoSenha ? "Atualizando..." : "Atualizar Senha"}
                </Button>
              </div>

              <Separator />

              {/* Sessão Atual */}
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Sessão Atual</h3>
                <div className="p-4 rounded-lg border bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {typeof navigator !== "undefined"
                          ? (() => {
                              const ua = navigator.userAgent;
                              const browser = ua.includes("Chrome")
                                ? "Chrome"
                                : ua.includes("Firefox")
                                ? "Firefox"
                                : ua.includes("Safari")
                                ? "Safari"
                                : "Navegador";
                              const os = ua.includes("Windows")
                                ? "Windows"
                                : ua.includes("Mac")
                                ? "macOS"
                                : ua.includes("Linux")
                                ? "Linux"
                                : "Desktop";
                              return `${browser} - ${os}`;
                            })()
                          : "Navegador"}
                      </p>
                      <p className="text-sm text-slate-500">
                        Conectado neste dispositivo • Agora
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">Atual</Badge>
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  O botão abaixo encerra sua conta em <strong>todos os dispositivos</strong>, inclusive neste.
                </p>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={async () => {
                    setEncerrandoSessoes(true);
                    try {
                      const { error } = await supabase.auth.signOut({ scope: "global" });
                      if (error) {
                        toast.error("Erro ao encerrar sessões: " + error.message);
                        return;
                      }
                      toast.success("Todas as sessões foram encerradas!");
                      window.location.href = "/login";
                    } catch (err: any) {
                      toast.error("Erro inesperado: " + (err?.message || "desconhecido"));
                    } finally {
                      setEncerrandoSessoes(false);
                    }
                  }}
                  disabled={encerrandoSessoes}
                >
                  {encerrandoSessoes ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {encerrandoSessoes ? "Encerrando..." : "Encerrar Todas as Sessões"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aparência */}
        <TabsContent value="aparencia" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aparência do Sistema</CardTitle>
              <CardDescription>
                Personalize a interface do CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <AparenciaContent />
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp — visível para todos (01/10/2026) */}
        <TabsContent value="whatsapp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conectar WhatsApp</CardTitle>
              <CardDescription>
                O número que o CRM usa para receber e responder mensagens. Clique em conectar e
                escaneie o QR pelo celular — a configuração é automática.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConectarWhatsApp />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrações */}
        <TabsContent value="integracoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrações</CardTitle>
              <CardDescription>
                Conecte o CRM com outros sistemas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  id: "whatsapp",
                  name: "WhatsApp Business",
                  desc: "Integração com WhatsApp API",
                  icon: "💬",
                  connected: true
                },
                {
                  id: "erp",
                  name: "ERP Empresarial",
                  desc: "Sincronização de vendas e produtos",
                  icon: "🏢",
                  connected: true
                },
                {
                  id: "email",
                  name: "E-mail",
                  desc: "Sincronização de e-mails",
                  icon: "📧",
                  connected: false
                },
                {
                  id: "calendar",
                  name: "Google Calendar",
                  desc: "Sincronização de agenda",
                  icon: "📅",
                  connected: false
                },
              ].map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{integration.icon}</div>
                    <div>
                      <p className="font-medium text-slate-900">{integration.name}</p>
                      <p className="text-sm text-slate-500">{integration.desc}</p>
                    </div>
                  </div>
                  {integration.connected ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700">Conectado</Badge>
                      <Button variant="outline" size="sm">Configurar</Button>
                    </div>
                  ) : (
                    <Button size="sm">Conectar</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equipe */}
        <TabsContent value="equipe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Vendedores</CardTitle>
              <CardDescription>
                Cadastre, edite e gerencie os vendedores da equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 mb-4">
                Acesse a página de vendedores para visualizar todos os membros da equipe,
                seus cargos, status e permissões.
              </p>
              <Button asChild>
                <a href="/configuracoes/vendedores">Gerenciar Vendedores</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
