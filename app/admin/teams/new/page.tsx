"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Upload, X, Trophy } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function NewTeamPage() {
  const [teamName, setTeamName] = useState("")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 2MB")
      return
    }

    if (!file.type.startsWith("image/")) {
      setError("O arquivo deve ser uma imagem")
      return
    }

    setError("")
    setLogoFile(file)

    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearLogo = () => {
    setLogoPreview(null)
    setLogoFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!teamName.trim()) {
      setError("O nome do time é obrigatório")
      return
    }

    setLoading(true)

    try {
      // Em produção, aqui seria uma chamada real à API
      // const formData = new FormData()
      // formData.append("name", teamName)
      // if (logoFile) {
      //   formData.append("logo", logoFile)
      // }

      // const response = await fetch("/api/admin/teams", {
      //   method: "POST",
      //   body: formData
      // })

      // if (!response.ok) {
      //   throw new Error("Erro ao criar time")
      // }

      // Simulando criação para demonstração
      await new Promise((resolve) => setTimeout(resolve, 1000))

      router.push("/admin/teams")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar time")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/admin/teams")} className="text-gray-400 hover:text-white">
          <ArrowLeft size={18} className="mr-2" />
          Voltar para Times
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Novo Time</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-800 text-white">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-white">
                Nome do Time
              </Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Digite o nome do time"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Logo do Time</Label>
              <div className="flex items-start space-x-4">
                <div className="w-24 h-24 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Trophy size={32} className="text-gold" />
                  )}
                </div>
                <div className="flex-1">
                  {logoPreview ? (
                    <div className="flex flex-col space-y-2">
                      <p className="text-sm text-gray-400">Logo carregada</p>
                      <Button type="button" variant="destructive" size="sm" onClick={clearLogo} className="w-fit">
                        <X size={16} className="mr-2" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-2">
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-md inline-flex items-center transition-colors w-fit"
                      >
                        <Upload size={16} className="mr-2" />
                        Carregar Logo
                      </label>
                      <p className="text-xs text-gray-400">PNG, JPG ou GIF (máx. 2MB)</p>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/teams")}
            className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-gold hover:bg-gold/80 text-black font-bold">
            {loading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Salvando...
              </span>
            ) : (
              "Salvar Time"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
