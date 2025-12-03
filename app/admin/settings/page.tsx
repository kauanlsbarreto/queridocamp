"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Save, User, Lock, Bell, Globe } from "lucide-react"

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)

    // Simulando salvamento
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSaving(false)
    setSuccess(true)

    // Limpar mensagem de sucesso após 3 segundos
    setTimeout(() => {
      setSuccess(false)
    }, 3000)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Configurações</h1>

      <Tabs defaultValue="account" className="max-w-4xl">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="account" className="data-[state=active]:bg-gold data-[state=active]:text-black">
            <User size={16} className="mr-2" />
            Conta
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-gold data-[state=active]:text-black">
            <Lock size={16} className="mr-2" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-gold data-[state=active]:text-black">
            <Bell size={16} className="mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="site" className="data-[state=active]:bg-gold data-[state=active]:text-black">
            <Globe size={16} className="mr-2" />
            Site
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Informações da Conta</CardTitle>
              <CardDescription className="text-gray-400">Atualize suas informações pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">
                  Nome
                </Label>
                <Input id="name" defaultValue="Administrador" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue="admin@queridocamp.com"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/80 text-black font-bold">
                {saving ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </span>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Segurança</CardTitle>
              <CardDescription className="text-gray-400">
                Gerencie sua senha e configurações de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-white">
                  Senha Atual
                </Label>
                <Input id="current-password" type="password" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-white">
                  Nova Senha
                </Label>
                <Input id="new-password" type="password" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white">
                  Confirmar Nova Senha
                </Label>
                <Input id="confirm-password" type="password" className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold/80 text-black font-bold ml-auto"
              >
                {saving ? "Salvando..." : "Atualizar Senha"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Notificações</CardTitle>
              <CardDescription className="text-gray-400">
                Configure como você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Notificações por Email</Label>
                  <p className="text-sm text-gray-400">Receba atualizações por email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Novas Partidas</Label>
                  <p className="text-sm text-gray-400">Seja notificado quando novas partidas forem agendadas</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Resultados</Label>
                  <p className="text-sm text-gray-400">Seja notificado quando partidas forem finalizadas</p>
                </div>
                <Switch />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold/80 text-black font-bold ml-auto"
              >
                {saving ? "Salvando..." : "Salvar Preferências"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="site">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Configurações do Site</CardTitle>
              <CardDescription className="text-gray-400">Gerencie as configurações gerais do site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-name" className="text-white">
                  Nome do Site
                </Label>
                <Input id="site-name" defaultValue="Querido Camp" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-description" className="text-white">
                  Descrição
                </Label>
                <Input
                  id="site-description"
                  defaultValue="O maior campeonato de Counter-Strike 2 de Sergipe"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Modo de Manutenção</Label>
                  <p className="text-sm text-gray-400">Ativar modo de manutenção no site</p>
                </div>
                <Switch />
              </div>
            </CardContent>
            <CardFooter>
              {success && (
                <Alert className="mr-4 bg-green-900/50 border-green-800 text-white">
                  <AlertDescription>Configurações salvas com sucesso!</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold/80 text-black font-bold ml-auto"
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
