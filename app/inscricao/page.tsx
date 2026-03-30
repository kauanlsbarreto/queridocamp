"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Upload, CheckCircle2, AlertCircle } from "lucide-react"
import HeroBanner from "@/components/hero-banner"
import PremiumCard from "@/components/premium-card"

export default function Inscricao() {
  const [formData, setFormData] = useState({
    email: "",
    nomeCompleto: "",
    idade: "",
    dataNascimento: "",
    estado: "",
    cidade: "",
    nick: "",
    faceitLink: "",
    gamersClubLink: "",
    steamLink: "",
    cpf: "",
    telefone: "",
    aceitaTermos: false,
  })
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setComprovante(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comprovante) {
      setError("Por favor, anexe o comprovante de pagamento.")
      return
    }
    setLoading(true)
    setError(null)

    const data = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, String(value))
    })
    data.append("comprovante", comprovante)

    try {
      const response = await fetch("/inscricao/api", { method: "POST", body: data })
      if (!response.ok) throw new Error("Falha ao enviar inscrição.")
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido.")
    } finally {
      setLoading(false)
    }
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
      <HeroBanner title="INSCRIÇÃO" subtitle="Faça sua inscrição na Querida" />

      <section className="py-16 bg-gradient-to-b from-dark to-dark/80 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Payment Information */}
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
                      <span className="font-semibold">Banco:</span> Inter
                    </p>
                    <p>
                      <span className="font-semibold">Nome Fantasia:</span> Querido Camp
                    </p>
                    <p>
                      <span className="font-semibold">Titular:</span> Denis Lima
                    </p>
                    <p className="text-xl font-bold text-primary mt-2">Valor: R$ 30,00</p>
                  </div>
                </div>
              </PremiumCard>
            </motion.div>

            {/* Registration Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <PremiumCard>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <h2 className="text-2xl font-bold text-primary mb-6">Dados do Participante</h2>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-light font-semibold mb-2">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="seu@email.com"
                    />
                  </div>

                  {/* Nome Completo */}
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

                  {/* Idade e Data de Nascimento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="idade" className="block text-light font-semibold mb-2">
                        Idade *
                      </label>
                      <input
                        type="number"
                        id="idade"
                        name="idade"
                        required
                        min="16"
                        value={formData.idade}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                        placeholder="18"
                      />
                    </div>
                    <div>
                      <label htmlFor="dataNascimento" className="block text-light font-semibold mb-2">
                        Data de Nascimento *
                      </label>
                      <input
                        type="date"
                        id="dataNascimento"
                        name="dataNascimento"
                        required
                        value={formData.dataNascimento}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  {/* Estado e Cidade */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="estado" className="block text-light font-semibold mb-2">
                        Estado *
                      </label>
                      <input
                        type="text"
                        id="estado"
                        name="estado"
                        required
                        value={formData.estado}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                        placeholder="Sergipe"
                      />
                    </div>
                    <div>
                      <label htmlFor="cidade" className="block text-light font-semibold mb-2">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        id="cidade"
                        name="cidade"
                        required
                        value={formData.cidade}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                        placeholder="Aracaju"
                      />
                    </div>
                  </div>

                  {/* Nick */}
                  <div>
                    <label htmlFor="nick" className="block text-light font-semibold mb-2">
                      Nick (o mesmo da plataforma Faceit) *
                    </label>
                    <input
                      type="text"
                      id="nick"
                      name="nick"
                      required
                      value={formData.nick}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                      placeholder="Seu nickname"
                    />
                  </div>

                  {/* Links */}
                  <div className="space-y-4">
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
                      <label htmlFor="gamersClubLink" className="block text-light font-semibold mb-2">
                        Link do perfil Gamers Club *
                      </label>
                      <input
                        type="url"
                        id="gamersClubLink"
                        name="gamersClubLink"
                        required
                        value={formData.gamersClubLink}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                        placeholder="https://gamersclub.com.br/..."
                      />
                    </div>
                    <div>
                      <label htmlFor="steamLink" className="block text-light font-semibold mb-2">
                        Link da Steam *
                      </label>
                      <input
                        type="url"
                        id="steamLink"
                        name="steamLink"
                        required
                        value={formData.steamLink}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                        placeholder="https://steamcommunity.com/..."
                      />
                    </div>
                  </div>

                  {/* CPF e Telefone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="cpf" className="block text-light font-semibold mb-2">
                        CPF *
                      </label>
                      <input
                        type="text"
                        id="cpf"
                        name="cpf"
                        required
                        value={formData.cpf}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-dark/50 border border-primary/30 rounded-lg text-light focus:outline-none focus:border-primary transition-colors"
                        placeholder="000.000.000-00"
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
                  </div>

                  {/* Terms Agreement */}
                  <div className="bg-dark/30 border border-primary/20 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-primary mb-3">Termos sobre Complete</h3>
                    <div className="text-light space-y-2 mb-4 text-sm">
                      <p>• O valor para utilizar um complete será de R$50,00 por partida.</p>
                      <p>
                        • Isso significa que, se um time X precisar de complete em 3 partidas, o custo total será de
                        R$150,00.
                      </p>
                      <p>• O pagamento deverá ser realizado antecipadamente, antes do início da partida.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        name="aceitaTermos"
                        required
                        checked={formData.aceitaTermos}
                        onChange={handleInputChange}
                        className="mt-1 w-5 h-5 rounded border-primary/30 bg-dark/50 text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="text-light group-hover:text-primary transition-colors">
                        Li e concordo com os termos sobre complete *
                      </span>
                    </label>
                  </div>

                  {/* File Upload */}
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

                  {/* Submit Button */}
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
