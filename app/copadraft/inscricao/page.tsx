"use client"

import type React from "react"
import { useState, useEffect } from "react"
import PageAccessGate from "@/components/page-access-gate"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, CheckCircle2, AlertCircle, ShieldCheck, X } from "lucide-react"

import HeroBanner from "@/components/hero-banner"
import PremiumCard from "@/components/premium-card"

export default function Inscricao() {
  return (
    <PageAccessGate level={1}>
      <InscricaoForm />
    </PageAccessGate>
  );
}

function InscricaoForm() {
  const [formData, setFormData] = useState({
    nomeCompleto: "",
    faceitLink: "",
    gcLink: "",
    steamLink: "",
    telefone: "",
    jogouOutrosDrafts: false,
  });
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banMessage, setBanMessage] = useState<string | null>(null);
  const [userAdminLevel, setUserAdminLevel] = useState(0);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({ nomeCompleto: "", faceitLink: "" });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  useEffect(() => {
    // Detect admin level from localStorage
    try {
      const raw = localStorage.getItem("faceit_user");
      if (raw) {
        const u = JSON.parse(raw);
        const lvl = Number(u?.Admin ?? u?.admin ?? 0);
        setUserAdminLevel(lvl);
      }
    } catch {}

    let interval: NodeJS.Timeout | null = null;
    async function checkBan() {
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("faceit_user");
          if (raw) {
            const user = JSON.parse(raw);
            if (user && user.nickname) {
              setFormData((prev) => ({
                ...prev,
                faceitLink: `https://www.faceit.com/pt/players/${user.nickname}`,
              }));
            }
            if (user && user.faceit_guid) {
              // Consulta diretamente a API de players
              const res = await fetch(`/api/admin/players?faceit_guid=${user.faceit_guid}`);
              if (res.ok) {
                const player = await res.json();
                if (player && player.ban === 1) {
                  setBanMessage("Você está banido de 1 Campeonato Draft. Se achar que é um erro, fale com a Administração.");
                } else {
                  setBanMessage(null);
                }
              } else {
                setBanMessage(null);
              }
            } else {
              setBanMessage(null);
            }
          } else {
            setBanMessage(null);
          }
        } catch {
          setBanMessage(null);
        }
      }
    }
    checkBan();
    interval = setInterval(checkBan, 5000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  } 

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setComprovante(e.target.files[0])
    }
  }

  const handleAdminModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.nomeCompleto.trim() || !modalForm.faceitLink.trim()) {
      setModalError("Preencha os dois campos.");
      return;
    }
    if (!modalForm.faceitLink.startsWith("https://www.faceit.com/")) {
      setModalError("O link da Faceit deve começar com https://www.faceit.com/");
      return;
    }
    setModalLoading(true);
    setModalError(null);

    try {
      // Fetch a placeholder image from the public folder to use as comprovante
      const imgRes = await fetch("/images/logo.png");
      const imgBlob = await imgRes.blob();
      const placeholderFile = new File([imgBlob], "comprovante-admin.png", { type: "image/png" });

      const data = new FormData();
      data.append("nomeCompleto", modalForm.nomeCompleto.trim());
      data.append("faceitLink", modalForm.faceitLink.trim());
      data.append("gcLink", "https://gamersclub.com.br/jogador/0");
      data.append("steamLink", "https://steamcommunity.com/profiles/0");
      data.append("telefone", "(00) 00000-0000");
      data.append("jogouOutrosDrafts", "false");
      data.append("comprovante", placeholderFile);

      const response = await fetch("/copadraft/inscricao/api", { method: "POST", body: data });
      if (!response.ok) throw new Error("Falha ao enviar inscrição.");
      setModalSuccess(true);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comprovante) {
      setError("Por favor, anexe o comprovante de pagamento.");
      return;
    }
    if (!formData.nomeCompleto.trim() || !formData.faceitLink.trim() || !formData.gcLink.trim() || !formData.steamLink.trim() || !formData.telefone.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!formData.faceitLink.startsWith("https://www.faceit.com/")) {
      setError("O link da Faceit deve começar com https://www.faceit.com/");
      return;
    }
    setLoading(true);
    setError(null);


    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, String(value));
    });
    // Adiciona o faceit_guid do localStorage, se existir
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("faceit_user");
        if (raw) {
          const user = JSON.parse(raw);
          if (user && user.faceit_guid) {
            data.append("faceit_guid", user.faceit_guid);
          }
        }
      } catch {}
    }
    data.append("comprovante", comprovante);

    try {
      // Atualiza endpoint para refletir a rota correta
      const response = await fetch("/copadraft/inscricao/api", { method: "POST", body: data });
      if (!response.ok) throw new Error("Falha ao enviar inscrição.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }


  if (banMessage) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(20, 0, 0, 0.98)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <PremiumCard>
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Acesso Bloqueado</h2>
            <p className="text-light mb-6">{banMessage}</p>
            <a
              href="/"
              className="inline-block bg-primary text-dark font-bold py-3 px-8 rounded-md hover:bg-primary/90 transition-colors"
            >
              Voltar para Home
            </a>
          </div>
        </PremiumCard>
      </div>
    );
  }

  if (submitted) {
    return (
      <div>
        <HeroBanner title="INSCRIÇÃO ENVIADA" subtitle="Sua inscrição foi recebida com sucesso!" />
        <section className="py-16 bg-gradient-to-b from-dark to-dark/80 min-h-screen flex items-center">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <PremiumCard>
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-20 h-20 text-primary mx-auto mb-6" />
                  <h2 className="text-2xl font-bold text-primary mb-4">Inscrição Recebida!</h2>
                  <p className="text-light mb-6">
                    Sua inscrição foi enviada com sucesso. Entraremos em contato em breve para confirmar sua
                    participação no campeonato.
                  </p>
                  <a
                    href="/"
                    className="inline-block bg-primary text-dark font-bold py-3 px-8 rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Voltar para Home
                  </a>
                </div>
              </PremiumCard>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div>
      <HeroBanner title="INSCRIÇÃO" subtitle="Faça sua inscrição no Querido Draft" />

      {(userAdminLevel === 1 || userAdminLevel === 2) && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => { setAdminModalOpen(true); setModalSuccess(false); setModalError(null); setModalForm({ nomeCompleto: "", faceitLink: "" }); }}
            className="flex items-center gap-2 bg-yellow-500 text-black font-bold py-3 px-5 rounded-full shadow-lg hover:bg-yellow-400 transition-colors"
          >
            <ShieldCheck className="w-5 h-5" />
            Inscrição Rápida
          </button>
        </div>
      )}

      <AnimatePresence>
        {adminModalOpen && (
          <motion.div
            key="admin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80"
            onClick={(e) => { if (e.target === e.currentTarget) setAdminModalOpen(false); }}
          >
            <motion.div
              key="admin-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md mx-4"
            >
              <PremiumCard>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5" />
                      Inscrição Rápida
                    </h2>
                    <button onClick={() => setAdminModalOpen(false)} className="text-light/60 hover:text-light transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {modalSuccess ? (
                    <div className="text-center py-4">
                      <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
                      <p className="text-light font-semibold">Inscrição enviada com sucesso!</p>
                      <button
                        onClick={() => { setAdminModalOpen(false); setModalSuccess(false); }}
                        className="mt-4 bg-primary text-dark font-bold py-2 px-6 rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleAdminModalSubmit} className="space-y-4">
                      <p className="text-light/60 text-sm">
                        Os outros campos serão preenchidos com valores de exemplo. O comprovante será uma imagem placeholder.
                      </p>
                      <div>
                        <label className="block text-light font-semibold mb-1 text-sm">Nome Completo *</label>
                        <input
                          type="text"
                          required
                          value={modalForm.nomeCompleto}
                          onChange={(e) => setModalForm((p) => ({ ...p, nomeCompleto: e.target.value }))}
                          className="w-full px-3 py-2 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors text-sm"
                          placeholder="Nome completo do jogador"
                        />
                      </div>
                      <div>
                        <label className="block text-light font-semibold mb-1 text-sm">Link do Perfil Faceit *</label>
                        <input
                          type="url"
                          required
                          value={modalForm.faceitLink}
                          onChange={(e) => setModalForm((p) => ({ ...p, faceitLink: e.target.value }))}
                          className="w-full px-3 py-2 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors text-sm"
                          placeholder="https://www.faceit.com/pt/players/..."
                        />
                      </div>
                      {modalError && (
                        <div className="text-red-400 bg-red-500/10 border border-red-400/30 p-2 rounded text-sm text-center">
                          {modalError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={modalLoading}
                        className="w-full bg-yellow-500 text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {modalLoading ? "Enviando..." : "Enviar Inscrição"}
                      </button>
                    </form>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="py-16 bg-gradient-to-b from-dark to-dark/80 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">

            {(userAdminLevel === 1 || userAdminLevel === 2) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6 flex justify-end"
              >
                <button
                  type="button"
                  onClick={() => { setAdminModalOpen(true); setModalSuccess(false); setModalError(null); setModalForm({ nomeCompleto: "", faceitLink: "" }); }}
                  className="flex items-center gap-2 bg-yellow-500 text-black font-bold py-2.5 px-5 rounded-lg shadow hover:bg-yellow-400 transition-colors"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Inscrição Rápida 
                </button>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <PremiumCard>
                <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-lg">
                  <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    Informações de Pagamento
                  </h3>
                  <div className="space-y-2 text-light">
                    <p className="font-semibold text-lg text-primary">PIX para Inscrição</p>
                    <p>
                      <span className="font-semibold">Chave PIX (CNPJ):</span> 63.790.373/0001-23
                    </p>
                    <p>
                      <span className="font-semibold">Banco:</span> Mercado Pago
                    </p>
                    <p>
                      <span className="font-semibold">Nome Fantasia:</span> Querido Camp
                    </p>
                    <p>
                      <span className="font-semibold">Titular:</span> Denis Lima
                    </p>
                    <p className="text-xl font-bold text-primary mt-2">Valor: R$ 80,00</p>
                  </div>
                </div>
              </PremiumCard>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <PremiumCard>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <h2 className="text-2xl font-bold text-primary mb-6">Dados do Participante</h2>
                  <div>
                    <label htmlFor="nomeCompleto" className="block text-light font-semibold mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      id="nomeCompleto"
                      name="nomeCompleto"
                      required
                      value={formData.nomeCompleto}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <label htmlFor="faceitLink" className="block text-light font-semibold mb-2">
                      Link do perfil Faceit *
                    </label>
                    <input
                      type="url"
                      id="faceitLink"
                      name="faceitLink"
                      required
                      value={formData.faceitLink}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="https://www.faceit.com/..."
                    />
                  </div>
                  <div>
                    <label htmlFor="telefone" className="block text-light font-semibold mb-2">
                      Número de telefone *
                    </label>
                    <input
                      type="tel"
                      id="telefone"
                      name="telefone"
                      required
                      value={formData.telefone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="(79) 99999-9999"
                    />
                  </div>
                  <div>
                    <label htmlFor="gcLink" className="block text-light font-semibold mb-2">
                      Link do perfil Gc *
                    </label>
                    <input
                      type="url"
                      id="gcLink"
                      name="gcLink"
                      required
                      value={formData.gcLink}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="Link do seu perfil Gc"
                    />
                  </div>
                  <div>
                    <label htmlFor="steamLink" className="block text-light font-semibold mb-2">
                      Link da steam *
                    </label>
                    <input
                      type="url"
                      id="steamLink"
                      name="steamLink"
                      required
                      value={formData.steamLink}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="Link do seu perfil Steam"
                    />
                  </div>
                  <div>
                    <label className="block text-light font-semibold mb-2">
                      Já jogou outros drafts?
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="jogouSim"
                          name="jogouOutrosDrafts"
                          value="true"
                          checked={formData.jogouOutrosDrafts === true}
                          onChange={(e) => setFormData((prev) => ({ ...prev, jogouOutrosDrafts: e.target.value === "true" }))}
                          className="mr-2"
                        />
                        <label htmlFor="jogouSim" className="text-light">
                          Sim
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="jogouNao"
                          name="jogouOutrosDrafts"
                          value="false"
                          checked={formData.jogouOutrosDrafts === false}
                          onChange={(e) => setFormData((prev) => ({ ...prev, jogouOutrosDrafts: e.target.value === "true" }))}
                          className="mr-2"
                        />
                        <label htmlFor="jogouNao" className="text-light">
                          Não
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-light font-semibold mb-2">Comprovante de Pagamento *</label>
                    <div className="relative">
                      <input
                        type="file"
                        id="comprovante"
                        required
                        onChange={handleFileChange}
                        accept="image/*,.pdf"
                        className="hidden"
                      />
                      <label
                        htmlFor="comprovante"
                        className="flex items-center justify-center gap-3 w-full px-4 py-6 bg-dark/50 border-2 border-dashed border-primary/30 rounded-lg text-light hover:border-primary hover:bg-dark/70 transition-all cursor-pointer group"
                      >
                        <Upload className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                        <span className="font-semibold">
                          {comprovante ? comprovante.name : "Clique para enviar o comprovante"}
                        </span>
                      </label>
                    </div>
                    <p className="text-light/60 text-sm mt-2">Formatos aceitos: JPG, PNG, PDF (máx. 5MB)</p>
                  </div>
                  {error && (
                    <div className="text-red-400 bg-red-500/10 border border-red-400/30 p-3 rounded-lg text-center">
                      {error}
                    </div>
                  )}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-primary text-dark font-bold py-4 px-8 rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:bg-primary/50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Enviando..." : "Enviar Inscrição"}
                  </motion.button>
                </form>
              </PremiumCard>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
