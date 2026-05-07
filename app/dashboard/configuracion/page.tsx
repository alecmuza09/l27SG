"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser, type User } from "@/lib/auth"
import { type Usuario } from "@/lib/data/usuarios"
import {
  getUsuariosAction,
  createUsuarioAction,
  updateUsuarioAction,
  deleteUsuarioAction,
  updateUsuarioPasswordAction,
} from "@/app/actions/usuarios"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { normalizeEmail } from "@/lib/utils"
import { Plus, Edit, Trash2, Loader2, UserPlus, Shield, UserCog, AlertCircle, Key, ChevronsUpDown, Check } from "lucide-react"
import { toast } from "sonner"

export default function ConfiguracionPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [passwordUsuario, setPasswordUsuario] = useState<Usuario | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Form states
  const [formEmail, setFormEmail] = useState("")
  const [formNombre, setFormNombre] = useState("")
  const [formRol, setFormRol] = useState<'admin' | 'manager' | 'staff' | 'branch-admin'>('staff')
  const [formSucursalIds, setFormSucursalIds] = useState<string[]>([])
  const [sucursalPopoverOpen, setSucursalPopoverOpen] = useState(false)
  const [formPassword, setFormPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin')

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
    
    async function loadData() {
      try {
        setIsLoading(true)
        if (user?.role === 'admin') {
          const [{ usuarios: usuariosData, error: usuariosError }, sucursalesData] = await Promise.all([
            getUsuariosAction(),
            getSucursalesActivasFromDB()
          ])
          if (usuariosError) toast.error(`Error cargando usuarios: ${usuariosError}`)
          setUsuarios(usuariosData)
          setSucursales(sucursalesData)
        }
      } catch (err) {
        console.error('Error cargando datos:', err)
        toast.error('Error cargando datos')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const toggleSucursal = (id: string) => {
    setFormSucursalIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleCreateUsuario = async () => {
    if (!formEmail || !formNombre || !formPassword || !formRol) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    if (formRol !== 'admin' && formSucursalIds.length === 0) {
      toast.error('Selecciona al menos una sucursal para managers, branch-admin y staff')
      return
    }

    // Normalizar email y mostrar advertencia si fue modificado
    const emailNormalizado = normalizeEmail(formEmail)
    if (emailNormalizado !== formEmail.toLowerCase()) {
      toast.warning(`El email será normalizado: "${formEmail}" → "${emailNormalizado}"`, {
        description: 'Se removieron acentos y caracteres especiales para compatibilidad con Supabase'
      })
    }

    try {
      const result = await createUsuarioAction({
        email: emailNormalizado,
        nombre: formNombre,
        rol: formRol,
        sucursalIds: formRol === 'admin' ? [] : formSucursalIds,
        password: formPassword,
      })

      if (result.success && result.usuario) {
        toast.success('Usuario creado exitosamente')
        const { usuarios: updated } = await getUsuariosAction()
        setUsuarios(updated)
        resetForm()
        setIsUserDialogOpen(false)
      } else {
        toast.error(result.error || 'Error creando usuario')
      }
    } catch (err) {
      console.error('Error creando usuario:', err)
      toast.error('Error creando usuario')
    }
  }

  const handleUpdateUsuario = async () => {
    if (!editingUsuario || !formNombre || !formRol) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    if (formRol !== 'admin' && formSucursalIds.length === 0) {
      toast.error('Selecciona al menos una sucursal para managers, branch-admin y staff')
      return
    }

    try {
      const result = await updateUsuarioAction(editingUsuario.id, {
        nombre: formNombre,
        rol: formRol,
        sucursalIds: formRol === 'admin' ? [] : formSucursalIds,
      })

      if (result.success && result.usuario) {
        toast.success('Usuario actualizado exitosamente')
        const { usuarios: updated } = await getUsuariosAction()
        setUsuarios(updated)
        resetForm()
        setIsUserDialogOpen(false)
        setEditingUsuario(null)
      } else {
        toast.error(result.error || 'Error actualizando usuario')
      }
    } catch (err) {
      console.error('Error actualizando usuario:', err)
      toast.error('Error actualizando usuario')
    }
  }

  const handleDeleteUsuario = async (usuarioId: string) => {
    if (!confirm('¿Estás seguro de desactivar este usuario?')) return

    try {
      const result = await deleteUsuarioAction(usuarioId)
      if (result.success) {
        toast.success('Usuario desactivado exitosamente')
        const { usuarios: updated } = await getUsuariosAction()
        setUsuarios(updated)
      } else {
        toast.error(result.error || 'Error desactivando usuario')
      }
    } catch (err) {
      console.error('Error desactivando usuario:', err)
      toast.error('Error desactivando usuario')
    }
  }

  const handleOpenPasswordDialog = (usuario: Usuario) => {
    setPasswordUsuario(usuario)
    setNewPassword("")
    setConfirmPassword("")
    setIsPasswordDialogOpen(true)
  }

  const handleChangePassword = async () => {
    if (!passwordUsuario) return

    if (!newPassword || newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await updateUsuarioPasswordAction(passwordUsuario.id, newPassword)
      if (result.success) {
        toast.success('Contraseña actualizada exitosamente')
        setIsPasswordDialogOpen(false)
        setPasswordUsuario(null)
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast.error(result.error || 'Error actualizando contraseña')
      }
    } catch (err) {
      console.error('Error actualizando contraseña:', err)
      toast.error('Error inesperado al actualizar la contraseña')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const resetForm = () => {
    setFormEmail("")
    setFormNombre("")
    setFormRol('staff')
    setFormSucursalIds([])
    setSucursalPopoverOpen(false)
    setFormPassword("")
    setEditingUsuario(null)
  }

  const openEditDialog = (usuario: Usuario) => {
    setEditingUsuario(usuario)
    setFormNombre(usuario.nombre)
    setFormRol(usuario.rol)
    setFormSucursalIds(usuario.sucursalIds ?? (usuario.sucursalId ? [usuario.sucursalId] : []))
    setFormEmail(usuario.email)
    setFormPassword("")
    setIsUserDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsUserDialogOpen(true)
  }

  const rolColors = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    staff: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  }

  const rolLabels = {
    admin: "Administrador",
    manager: "Manager",
    staff: "Staff",
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground">Ajustes generales del sistema</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando configuración...</p>
          </div>
        </div>
      ) : (
      <Tabs defaultValue={currentUser?.role === 'admin' ? "usuarios" : "general"} className="space-y-4">
        <TabsList>
          {isAdmin && <TabsTrigger value="usuarios">Usuarios</TabsTrigger>}
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="usuarios" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Gestión de Usuarios
                    </CardTitle>
                    <CardDescription>
                      Administra usuarios, administradores y managers del sistema
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateDialog}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {usuarios.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay usuarios registrados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuarios.map((usuario) => (
                        <TableRow key={usuario.id}>
                          <TableCell className="font-medium">{usuario.nombre}</TableCell>
                          <TableCell>{usuario.email}</TableCell>
                          <TableCell>
                            <Badge className={rolColors[usuario.rol]}>
                              {rolLabels[usuario.rol]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {usuario.sucursalesNombres && usuario.sucursalesNombres.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {usuario.sucursalesNombres.map((nombre) => (
                                  <Badge key={nombre} variant="outline" className="text-xs font-normal">
                                    {nombre}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Todas</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={usuario.activo ? "default" : "secondary"}>
                              {usuario.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(usuario)}
                                title="Editar usuario"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenPasswordDialog(usuario)}
                                title="Cambiar contraseña"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              {usuario.id !== currentUser?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUsuario(usuario.id)}
                                  title="Desactivar usuario"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Dialog: Crear/Editar Usuario */}
            <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
              setIsUserDialogOpen(open)
              if (!open) {
                resetForm()
                setEditingUsuario(null)
              }
            }}>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingUsuario ? "Editar Usuario" : "Nuevo Usuario"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingUsuario 
                      ? "Modifica la información del usuario" 
                      : "Crea un nuevo usuario para el sistema"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="usuario@luna27.com"
                      disabled={!!editingUsuario}
                    />
                    {formEmail && normalizeEmail(formEmail) !== formEmail.toLowerCase() && (
                      <div className="flex items-start gap-2 p-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-amber-800 dark:text-amber-300 font-medium">
                            El email será normalizado automáticamente
                          </p>
                          <p className="text-amber-700 dark:text-amber-400 mt-1">
                            <span className="font-mono">{formEmail}</span> → <span className="font-mono">{normalizeEmail(formEmail)}</span>
                          </p>
                          <p className="text-amber-600 dark:text-amber-500 mt-1">
                            Se removerán acentos y caracteres especiales para compatibilidad.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rol">Rol *</Label>
                    <Select
                      value={formRol}
                      onValueChange={(v) => setFormRol(v as 'admin' | 'manager' | 'staff' | 'branch-admin')}
                    >
                      <SelectTrigger id="rol">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="branch-admin">Branch admin (sucursal)</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formRol !== 'admin' && (
                    <div className="grid gap-2">
                      <Label>Sucursales *</Label>
                      <Popover modal={false} open={sucursalPopoverOpen} onOpenChange={setSucursalPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="truncate text-left">
                              {formSucursalIds.length === 0
                                ? <span className="text-muted-foreground">Seleccionar sucursales...</span>
                                : formSucursalIds.length === 1
                                  ? sucursales.find((s) => s.id === formSucursalIds[0])?.nombre
                                  : `${formSucursalIds.length} sucursales seleccionadas`}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="z-[200] flex w-[var(--radix-popover-trigger-width)] flex-col gap-0 overflow-hidden p-0 shadow-md"
                          align="start"
                          sideOffset={4}
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <div
                            role="listbox"
                            aria-label="Lista de sucursales"
                            className="max-h-[min(60vh,380px)] min-h-0 overflow-y-auto overscroll-contain p-1 [-webkit-overflow-scrolling:touch]"
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {sucursales.map((s) => {
                              const selected = formSucursalIds.includes(s.id)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => toggleSucursal(s.id)}
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Checkbox
                                    checked={selected}
                                    className="pointer-events-none"
                                    aria-hidden
                                  />
                                  <span className="flex-1 text-left">{s.nombre}</span>
                                  {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                </button>
                              )
                            })}
                          </div>
                          {formSucursalIds.length > 0 && (
                            <div className="shrink-0 border-t bg-popover px-1 pb-1 pt-1">
                              <button
                                type="button"
                                onClick={() => setFormSucursalIds([])}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                              >
                                Limpiar selección
                              </button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      {formSucursalIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {formSucursalIds.map((id) => {
                            const s = sucursales.find((x) => x.id === id)
                            return s ? (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="cursor-pointer text-xs"
                                onClick={() => toggleSucursal(id)}
                              >
                                {s.nombre} ×
                              </Badge>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {!editingUsuario && (
                    <div className="grid gap-2">
                      <Label htmlFor="password">Contraseña *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsUserDialogOpen(false)
                      resetForm()
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={editingUsuario ? handleUpdateUsuario : handleCreateUsuario}
                    disabled={
                      !formNombre || 
                      !formRol || 
                      (!editingUsuario && (!formEmail || !formPassword)) ||
                      (formRol !== 'admin' && formSucursalIds.length === 0)
                    }
                  >
                    {editingUsuario ? "Guardar Cambios" : "Crear Usuario"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog: Cambiar Contraseña */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
              setIsPasswordDialogOpen(open)
              if (!open) {
                setPasswordUsuario(null)
                setNewPassword("")
                setConfirmPassword("")
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cambiar Contraseña</DialogTitle>
                  <DialogDescription>
                    {passwordUsuario && `Actualiza la contraseña de ${passwordUsuario.nombre}`}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">Nueva Contraseña *</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      disabled={isChangingPassword}
                    />
                    <p className="text-xs text-muted-foreground">
                      La contraseña debe tener al menos 6 caracteres
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      disabled={isChangingPassword}
                    />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <div className="flex items-start gap-2 p-2 text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-red-800 dark:text-red-300">
                        Las contraseñas no coinciden
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPasswordDialogOpen(false)
                      setPasswordUsuario(null)
                      setNewPassword("")
                      setConfirmPassword("")
                    }}
                    disabled={isChangingPassword}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleChangePassword}
                    disabled={
                      !newPassword || 
                      newPassword.length < 6 || 
                      newPassword !== confirmPassword ||
                      isChangingPassword
                    }
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      "Actualizar Contraseña"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Negocio</CardTitle>
              <CardDescription>Datos generales de Luna27</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreNegocio">Nombre del Negocio</Label>
                  <Input id="nombreNegocio" defaultValue="Luna27 Spa" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rfc">RFC</Label>
                  <Input id="rfc" placeholder="ABC123456XYZ" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de Contacto</Label>
                <Input id="email" type="email" defaultValue="contacto@luna27.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" defaultValue="+52 55 1234 5678" />
              </div>
              <Button>Guardar Cambios</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferencias del Sistema</CardTitle>
              <CardDescription>Configuración de la aplicación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Zona Horaria</Label>
                  <p className="text-sm text-muted-foreground">Ajusta la zona horaria del sistema</p>
                </div>
                <Select defaultValue="cdmx">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cdmx">Ciudad de México (GMT-6)</SelectItem>
                    <SelectItem value="monterrey">Monterrey (GMT-6)</SelectItem>
                    <SelectItem value="guadalajara">Guadalajara (GMT-6)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Idioma</Label>
                  <p className="text-sm text-muted-foreground">Idioma de la interfaz</p>
                </div>
                <Select defaultValue="es">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notificaciones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notificaciones por Email</CardTitle>
              <CardDescription>Configura las notificaciones automáticas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Confirmación de Citas</Label>
                  <p className="text-sm text-muted-foreground">Enviar email al confirmar una cita</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Recordatorio de Citas</Label>
                  <p className="text-sm text-muted-foreground">Recordatorio 24h antes de la cita</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas de Inventario</Label>
                  <p className="text-sm text-muted-foreground">Notificar cuando el stock esté bajo</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificaciones SMS</CardTitle>
              <CardDescription>Mensajes de texto automáticos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Confirmación de Citas</Label>
                  <p className="text-sm text-muted-foreground">SMS al confirmar una cita</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Recordatorio de Citas</Label>
                  <p className="text-sm text-muted-foreground">SMS 2h antes de la cita</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pago</CardTitle>
              <CardDescription>Configura las opciones de pago disponibles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Efectivo</Label>
                  <p className="text-sm text-muted-foreground">Aceptar pagos en efectivo</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tarjeta de Crédito/Débito</Label>
                  <p className="text-sm text-muted-foreground">Terminal punto de venta</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Transferencia Bancaria</Label>
                  <p className="text-sm text-muted-foreground">Pagos por transferencia</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguridad" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seguridad</CardTitle>
              <CardDescription>Configuración de seguridad y privacidad</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Autenticación de Dos Factores</Label>
                  <p className="text-sm text-muted-foreground">Seguridad adicional para el inicio de sesión</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Backup Automático</Label>
                  <p className="text-sm text-muted-foreground">Respaldo diario de datos</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label>Cambiar Contraseña</Label>
                <div className="space-y-2">
                  <Input type="password" placeholder="Contraseña actual" />
                  <Input type="password" placeholder="Nueva contraseña" />
                  <Input type="password" placeholder="Confirmar nueva contraseña" />
                </div>
                <Button>Actualizar Contraseña</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  )
}
