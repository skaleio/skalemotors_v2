import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Plus, Search, PhoneCall, PhoneIncoming, PhoneOutgoing, MessageSquare, Play, Pause, Volume2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { initiateWhatsappCall, fetchWhatsappCalls, updateCallNotes, type WhatsappCall } from "@/lib/services/whatsappCalls";
import { toast } from "@/hooks/use-toast";

export default function Calls() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [calls, setCalls] = useState<WhatsappCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callPhone, setCallPhone] = useState("");
  const [selectedCall, setSelectedCall] = useState<WhatsappCall | null>(null);
  const [callNotes, setCallNotes] = useState("");

  useEffect(() => {
    loadCalls();
  }, [user?.branch_id]);

  const loadCalls = async () => {
    try {
      setLoading(true);
      const data = await fetchWhatsappCalls({
        branchId: user?.branch_id ?? undefined,
        limit: 100,
      });
      setCalls(data);
    } catch (error) {
      console.error("Error loading calls:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las llamadas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!callPhone.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor, ingresa un número de teléfono.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await initiateWhatsappCall({
        to: callPhone,
      });
      
      toast({
        title: "Llamada iniciada",
        description: `Llamada a ${callPhone} iniciada exitosamente.`,
      });
      
      setShowCallDialog(false);
      setCallPhone("");
      loadCalls();
    } catch (error: any) {
      console.error("Error initiating call:", error);
      toast({
        title: "Error",
        description: error?.message || "No se pudo iniciar la llamada.",
        variant: "destructive",
      });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCall) return;

    try {
      await updateCallNotes(selectedCall.id, callNotes);
      toast({
        title: "Notas guardadas",
        description: "Las notas se guardaron exitosamente.",
      });
      setSelectedCall(null);
      setCallNotes("");
      loadCalls();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las notas.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      iniciando: { variant: "outline", label: "Iniciando" },
      en_curso: { variant: "default", label: "En Curso" },
      completada: { variant: "default", label: "Completada" },
      fallida: { variant: "destructive", label: "Fallida" },
      cancelada: { variant: "secondary", label: "Cancelada" },
      no_contestada: { variant: "secondary", label: "No Contestada" },
    };

    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredCalls = calls.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.contact_phone.toLowerCase().includes(query) ||
      (call.contact_name && call.contact_name.toLowerCase().includes(query))
    );
  });

  const totalCalls = calls.length;
  const incomingCalls = calls.filter(c => c.direction === "entrante").length;
  const outgoingCalls = calls.filter(c => c.direction === "saliente").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Llamadas</h1>
          <p className="text-muted-foreground mt-2">
            Registro y seguimiento de llamadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Llamada
          </Button>
          <Button onClick={() => setShowCallDialog(true)}>
            <Phone className="h-4 w-4 mr-2" />
            Llamar por WhatsApp
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Llamadas Totales</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Cargando datos..." : "Total de llamadas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrantes</CardTitle>
            <PhoneIncoming className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : incomingCalls}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Cargando datos..." : "Llamadas recibidas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salientes</CardTitle>
            <PhoneOutgoing className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : outgoingCalls}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Cargando datos..." : "Llamadas realizadas"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar llamadas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Historial de Llamadas
          </CardTitle>
          <CardDescription>
            Registro completo de todas las llamadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando llamadas...
                  </TableCell>
                </TableRow>
              ) : filteredCalls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No se encontraron llamadas" : "No hay llamadas registradas"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCalls.map((call) => (
                  <TableRow key={call.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setSelectedCall(call);
                    setCallNotes(call.notes || "");
                  }}>
                    <TableCell>
                      {new Date(call.started_at || call.created_at).toLocaleString("es-CL")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{call.contact_name || "Sin nombre"}</p>
                        <p className="text-sm text-muted-foreground">{call.contact_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={call.direction === "entrante" ? "default" : "outline"}>
                        {call.direction === "entrante" ? (
                          <PhoneIncoming className="h-3 w-3 mr-1" />
                        ) : (
                          <PhoneOutgoing className="h-3 w-3 mr-1" />
                        )}
                        {call.direction === "entrante" ? "Entrante" : "Saliente"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                    <TableCell>{getStatusBadge(call.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {call.recording_url && (
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            window.open(call.recording_url!, "_blank");
                          }}>
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                          setCallNotes(call.notes || "");
                        }}>
                          Ver Detalles
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog para iniciar llamada */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Llamada por WhatsApp</DialogTitle>
            <DialogDescription>
              Realiza una llamada de voz a través de WhatsApp Business
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="call-phone">Número de Teléfono</Label>
              <Input
                id="call-phone"
                placeholder="+56 9 1234 5678"
                value={callPhone}
                onChange={(e) => setCallPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Incluye el código de país (ej: +56 para Chile)
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                ⚠️ <strong>Importante:</strong> Asegúrate de tener el consentimiento del cliente antes de realizar llamadas salientes, según las políticas de WhatsApp Business.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInitiateCall}>
              <Phone className="h-4 w-4 mr-2" />
              Iniciar Llamada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver detalles de llamada */}
      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Llamada</DialogTitle>
            <DialogDescription>
              Información completa de la llamada
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Contacto</Label>
                  <p className="font-medium">{selectedCall.contact_name || "Sin nombre"}</p>
                  <p className="text-sm text-muted-foreground">{selectedCall.contact_phone}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <div className="mt-1">{getStatusBadge(selectedCall.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dirección</Label>
                  <p className="font-medium">
                    {selectedCall.direction === "entrante" ? "Entrante" : "Saliente"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Duración</Label>
                  <p className="font-medium">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Inicio</Label>
                  <p className="font-medium">
                    {selectedCall.started_at 
                      ? new Date(selectedCall.started_at).toLocaleString("es-CL")
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fin</Label>
                  <p className="font-medium">
                    {selectedCall.ended_at 
                      ? new Date(selectedCall.ended_at).toLocaleString("es-CL")
                      : "-"}
                  </p>
                </div>
              </div>

              {selectedCall.recording_url && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Grabación</Label>
                  <audio controls className="w-full">
                    <source src={selectedCall.recording_url} type="audio/mpeg" />
                    Tu navegador no soporta audio.
                  </audio>
                </div>
              )}

              {selectedCall.transcript && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Transcripción</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {selectedCall.transcript}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="call-notes">Notas</Label>
                <Textarea
                  id="call-notes"
                  placeholder="Agrega notas sobre esta llamada..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedCall(null);
              setCallNotes("");
            }}>
              Cerrar
            </Button>
            <Button onClick={handleSaveNotes}>
              Guardar Notas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
