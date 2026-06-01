import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  ScrollText,
  Plus,
  Printer,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  FileSignature,
  XCircle,
  Search,
  Car,
  User,
  DollarSign,
  ChevronLeft,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/contexts/AuthContext";
import { documentService, Document, DocumentType, DocumentStatus } from "@/lib/services/documents";
import { vehicleService } from "@/lib/services/vehicles";
import { consignacionesService } from "@/lib/services/consignaciones";
import { leadService } from "@/lib/services/leads";
import { supabase } from "@/lib/supabase";
import { InventoryVehiclePicker } from "@/components/documents/InventoryVehiclePicker";
import { DocumentContractBody } from "@/components/documents/DocumentContractBody";
import {
  emptyVentaForm,
  emptyConsignacionForm,
  mapVehicleToVentaForm,
  mapVehicleToConsignacionForm,
  mapConsignacionToForm,
  mapLeadToBuyer,
  documentToVentaForm,
  documentToConsignacionForm,
  ventaFormToPreview,
  consignacionFormToPreview,
  ventaFormToInsert,
  consignacionFormToInsert,
  ventaFormToUpdate,
  consignacionFormToUpdate,
  type VentaFormState,
  type ConsignacionFormState,
} from "@/lib/documents/mappers";
import type { Database } from "@/lib/types/database";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

// ─── helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DocumentStatus, string> = {
  borrador: "Borrador",
  generado: "Generado",
  firmado: "Firmado",
  anulado: "Anulado",
};

const STATUS_ICONS: Record<DocumentStatus, React.ReactNode> = {
  borrador: <Clock className="h-3 w-3" />,
  generado: <Eye className="h-3 w-3" />,
  firmado: <CheckCircle className="h-3 w-3" />,
  anulado: <XCircle className="h-3 w-3" />,
};

const STATUS_VARIANTS: Record<DocumentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  borrador: "secondary",
  generado: "default",
  firmado: "outline",
  anulado: "destructive",
};

function formatCLP(amount: number | null | undefined): string {
  if (!amount) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Preview component ──────────────────────────────────────────────────────────

interface PreviewProps {
  doc: Document;
  issuerName?: string;
}

function DocumentPreview({ doc, issuerName }: PreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(doc.document_number ?? "")}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 40px; }
          h1 { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: bold; margin: 16px 0 8px; border-bottom: 1px solid #000; padding-bottom: 4px; }
          .header { text-align: center; margin-bottom: 24px; }
          .doc-number { font-size: 13px; color: #444; margin-bottom: 2px; }
          .doc-date { font-size: 11px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          td { padding: 5px 8px; border: 1px solid #ccc; }
          td:first-child { font-weight: bold; width: 35%; background: #f5f5f5; }
          .signature-section { display: flex; justify-content: space-between; margin-top: 48px; }
          .signature-box { text-align: center; width: 40%; }
          .signature-line { border-top: 1px solid #000; padding-top: 8px; margin-top: 48px; font-size: 11px; }
          .footer { text-align: center; margin-top: 32px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
          .legal { margin-top: 16px; font-size: 10px; color: #555; line-height: 1.5; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-pink-500" />
          Vista previa — {doc.document_number}
        </DialogTitle>
      </DialogHeader>

      <div className="flex justify-end mb-4">
        <Button onClick={handlePrint} className="gap-2 bg-pink-600 hover:bg-pink-700 text-white">
          <Printer className="h-4 w-4" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div
        ref={printRef}
        className="bg-white text-black p-8 border border-gray-200 rounded-lg text-sm"
      >
        <DocumentContractBody doc={doc} issuerName={issuerName} />
      </div>
    </DialogContent>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function Documents() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determinar tab activo: primero por path, luego por query param
  const getActiveTabFromPath = (): DocumentType => {
    if (location.pathname.endsWith("/consignacion")) return "contrato_consignacion";
    if (location.pathname.endsWith("/venta")) return "contrato_venta";
    return (searchParams.get("type") as DocumentType) ?? "contrato_venta";
  };
  const activeTab = getActiveTabFromPath();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | "all">("all");

  const [ventaForm, setVentaForm] = useState<VentaFormState>(emptyVentaForm);
  const [consignacionForm, setConsignacionForm] = useState<ConsignacionFormState>(emptyConsignacionForm);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const prefillKeyRef = useRef<string | null>(null);

  const { data: issuerName } = useQuery({
    queryKey: ["document-issuer", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return null;
      const { data, error } = await supabase
        .from("branches")
        .select("name")
        .eq("id", user.branch_id)
        .single();
      if (error) throw error;
      return data?.name ?? null;
    },
    enabled: !!user?.branch_id,
    staleTime: 5 * 60_000,
  });

  const livePreviewDoc = useMemo(() => {
    if (activeTab === "contrato_venta") {
      return ventaFormToPreview(ventaForm, {
        document_number: editingDocId
          ? documents.find((d) => d.id === editingDocId)?.document_number ?? "BORRADOR"
          : "BORRADOR",
      });
    }
    return consignacionFormToPreview(consignacionForm, {
      document_number: editingDocId
        ? documents.find((d) => d.id === editingDocId)?.document_number ?? "BORRADOR"
        : "BORRADOR",
    });
  }, [activeTab, ventaForm, consignacionForm, editingDocId, documents]);

  const resetForms = () => {
    setVentaForm(emptyVentaForm());
    setConsignacionForm(emptyConsignacionForm());
    setEditingDocId(null);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForms();
    prefillKeyRef.current = null;
    if (searchParams.toString()) {
      navigate(location.pathname, { replace: true });
    }
  };

  const openEdit = (doc: Document) => {
    if (doc.type === "contrato_venta") {
      setVentaForm(documentToVentaForm(doc));
      if (!location.pathname.endsWith("/venta")) {
        navigate("/app/documents/venta");
      }
    } else {
      setConsignacionForm(documentToConsignacionForm(doc));
      if (!location.pathname.endsWith("/consignacion")) {
        navigate("/app/documents/consignacion");
      }
    }
    setEditingDocId(doc.id);
    setShowForm(true);
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await documentService.getAll({
        branchId: user?.branch_id ?? undefined,
      });
      setDocuments(data);
    } catch {
      toast.error("No se pudieron cargar los documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user?.branch_id]);

  useEffect(() => {
    const paramKey = searchParams.toString();
    if (!paramKey || prefillKeyRef.current === paramKey) return;

    let cancelled = false;

    const prefill = async () => {
      const editId = searchParams.get("edit");
      const vehicleId = searchParams.get("vehicleId");
      const consignacionId = searchParams.get("consignacionId");
      const leadId = searchParams.get("leadId");

      if (editId) {
        const existing = documents.find((d) => d.id === editId) ?? (await documentService.getById(editId));
        if (!cancelled && existing) {
          openEdit(existing);
        }
        return;
      }

      if (vehicleId) {
        try {
          const v = await vehicleService.getById(vehicleId);
          if (cancelled) return;
          if (activeTab === "contrato_venta") {
            setVentaForm((p) => ({ ...p, ...mapVehicleToVentaForm(v) }));
          } else {
            setConsignacionForm((p) => ({ ...p, ...mapVehicleToConsignacionForm(v) }));
          }
          setShowForm(true);
        } catch {
          toast.error("No se pudo cargar el vehículo del inventario");
        }
        return;
      }

      if (consignacionId && activeTab === "contrato_consignacion") {
        try {
          const list = await consignacionesService.getAll({ branchId: user?.branch_id });
          const c = list.find((x) => x.id === consignacionId);
          if (!cancelled && c) {
            setConsignacionForm((p) => ({ ...p, ...mapConsignacionToForm(c) }));
            setShowForm(true);
          }
        } catch {
          toast.error("No se pudo cargar la consignación");
        }
        return;
      }

      if (leadId && activeTab === "contrato_venta") {
        try {
          const lead = await leadService.getById(leadId);
          if (!cancelled && lead) {
            setVentaForm((p) => ({ ...p, ...mapLeadToBuyer(lead) }));
            setShowForm(true);
          }
        } catch {
          toast.error("No se pudo cargar el lead");
        }
      }

      prefillKeyRef.current = paramKey;
    };

    void prefill();
    return () => {
      cancelled = true;
    };
  }, [searchParams, activeTab, user?.branch_id, documents.length]);

  const handleTabChange = (val: string) => {
    const path = val === "contrato_consignacion"
      ? "/app/documents/consignacion"
      : "/app/documents/venta";
    navigate(path);
    closeForm();
  };

  const saveCtx = () => ({
    branch_id: user?.branch_id ?? null,
    tenant_id: user?.tenant_id ?? null,
    created_by: user?.id ?? null,
  });

  const handleSaveVenta = async (asDraft: boolean) => {
    if (!ventaForm.vehicle_make || !ventaForm.buyer_name || !ventaForm.sale_price) {
      toast.error("Completa los campos obligatorios: marca, nombre comprador y precio");
      return;
    }
    const status: DocumentStatus = asDraft ? "borrador" : "generado";
    try {
      setSaving(true);
      let doc: Document;
      if (editingDocId) {
        doc = await documentService.update(editingDocId, {
          ...ventaFormToUpdate(ventaForm),
          status,
        });
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
        toast.success(asDraft ? "Borrador actualizado" : `Contrato ${doc.document_number} actualizado`);
      } else {
        doc = await documentService.create(
          ventaFormToInsert(ventaForm, { ...saveCtx(), status })
        );
        setDocuments((prev) => [doc, ...prev]);
        toast.success(
          asDraft ? "Borrador guardado" : `Contrato ${doc.document_number} generado`
        );
      }
      closeForm();
      if (!asDraft) setPreviewDoc(doc);
    } catch {
      toast.error("Error al guardar el contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConsignacion = async (asDraft: boolean) => {
    if (!consignacionForm.vehicle_make || !consignacionForm.owner_name || !consignacionForm.sale_price) {
      toast.error("Completa los campos obligatorios: marca, nombre propietario y precio");
      return;
    }
    const status: DocumentStatus = asDraft ? "borrador" : "generado";
    try {
      setSaving(true);
      let doc: Document;
      if (editingDocId) {
        doc = await documentService.update(editingDocId, {
          ...consignacionFormToUpdate(consignacionForm),
          status,
        });
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
        toast.success(asDraft ? "Borrador actualizado" : `Contrato ${doc.document_number} actualizado`);
      } else {
        doc = await documentService.create(
          consignacionFormToInsert(consignacionForm, { ...saveCtx(), status })
        );
        setDocuments((prev) => [doc, ...prev]);
        toast.success(
          asDraft ? "Borrador guardado" : `Contrato ${doc.document_number} generado`
        );
      }
      closeForm();
      if (!asDraft) setPreviewDoc(doc);
    } catch {
      toast.error("Error al guardar el contrato");
    } finally {
      setSaving(false);
    }
  };

  const onVentaVehicleSelect = (vehicle: Vehicle | null) => {
    if (!vehicle) {
      setVentaForm((p) => ({ ...p, vehicle_id: "" }));
      return;
    }
    setVentaForm((p) => ({ ...p, ...mapVehicleToVentaForm(vehicle) }));
  };

  const onConsignacionVehicleSelect = (vehicle: Vehicle | null) => {
    if (!vehicle) {
      setConsignacionForm((p) => ({ ...p, vehicle_id: "" }));
      return;
    }
    setConsignacionForm((p) => ({ ...p, ...mapVehicleToConsignacionForm(vehicle) }));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await documentService.delete(deleteId);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteId));
      toast.success("Documento eliminado");
    } catch {
      toast.error("Error al eliminar el documento");
    } finally {
      setDeleteId(null);
    }
  };

  const handleStatusChange = async (id: string, status: DocumentStatus) => {
    try {
      const updated = await documentService.updateStatus(id, status);
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar el estado");
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesTab = d.type === activeTab;
    const matchesStatus = filterStatus === "all" || d.status === filterStatus;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      d.document_number?.toLowerCase().includes(searchLower) ||
      d.buyer_name?.toLowerCase().includes(searchLower) ||
      d.owner_name?.toLowerCase().includes(searchLower) ||
      d.vehicle_make?.toLowerCase().includes(searchLower) ||
      d.vehicle_model?.toLowerCase().includes(searchLower) ||
      d.vehicle_patente?.toLowerCase().includes(searchLower);
    return matchesTab && matchesStatus && matchesSearch;
  });

  // ── Form field helper ────────────────────────────────────────────────────────
  const FieldGroup = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
        {label} {required && <span className="text-pink-500">*</span>}
      </Label>
      {children}
    </div>
  );

  // ── Stats ────────────────────────────────────────────────────────────────────
  const tabDocs = documents.filter((d) => d.type === activeTab);
  const stats = {
    total: tabDocs.length,
    generados: tabDocs.filter((d) => d.status === "generado").length,
    firmados: tabDocs.filter((d) => d.status === "firmado").length,
    borradores: tabDocs.filter((d) => d.status === "borrador").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950/40">
            <FileText className="h-6 w-6 text-pink-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Documentos</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Genera y gestiona contratos de venta y consignación
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-slate-100 dark:bg-zinc-800">
            <TabsTrigger value="contrato_venta" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
              <FileText className="h-4 w-4" />
              Contratos de Venta
            </TabsTrigger>
            <TabsTrigger value="contrato_consignacion" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
              <ScrollText className="h-4 w-4" />
              Contratos de Consignación
            </TabsTrigger>
          </TabsList>

          {!showForm && (
            <Button
              onClick={() => {
                resetForms();
                setShowForm(true);
              }}
              className="gap-2 bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nuevo {activeTab === "contrato_venta" ? "Contrato de Venta" : "Contrato de Consignación"}
            </Button>
          )}
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Total", value: stats.total, color: "text-slate-700 dark:text-zinc-300" },
            { label: "Generados", value: stats.generados, color: "text-blue-600 dark:text-blue-400" },
            { label: "Firmados", value: stats.firmados, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Borradores", value: stats.borradores, color: "text-amber-600 dark:text-amber-400" },
          ].map((s) => (
            <Card key={s.label} className="border-0 bg-slate-50 dark:bg-zinc-800/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 dark:text-zinc-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Form panel ── */}
        {showForm && (
          <Card className="mt-4 border border-pink-100 dark:border-pink-900/30 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-pink-500" />
                  {editingDocId
                    ? "Editar contrato"
                    : activeTab === "contrato_venta"
                      ? "Nuevo Contrato de Venta"
                      : "Nuevo Contrato de Consignación"}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeForm}
                  className="gap-1 text-slate-500 hover:text-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Volver
                </Button>
              </div>
            </CardHeader>
            <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6 min-w-0">

              {/* ─── VENTA FORM ─── */}
              <TabsContent value="contrato_venta" className="mt-0 space-y-6">
                {/* Vehicle */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Car className="h-4 w-4 text-pink-500" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Datos del Vehículo</span>
                  </div>
                  <FieldGroup label="Desde inventario">
                    <InventoryVehiclePicker
                      branchId={user?.branch_id}
                      value={ventaForm.vehicle_id}
                      onSelect={onVentaVehicleSelect}
                    />
                  </FieldGroup>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <FieldGroup label="Marca" required>
                      <Input
                        placeholder="Toyota"
                        value={ventaForm.vehicle_make}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_make: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Modelo">
                      <Input
                        placeholder="Corolla"
                        value={ventaForm.vehicle_model}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_model: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Año">
                      <Input
                        type="number"
                        placeholder="2022"
                        value={ventaForm.vehicle_year}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_year: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Color">
                      <Input
                        placeholder="Blanco"
                        value={ventaForm.vehicle_color}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_color: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Patente">
                      <Input
                        placeholder="ABCD12"
                        className="uppercase"
                        value={ventaForm.vehicle_patente}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_patente: e.target.value.toUpperCase() }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="VIN / N° Motor">
                      <Input
                        placeholder="VIN123456"
                        value={ventaForm.vehicle_vin}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_vin: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Kilometraje">
                      <Input
                        type="number"
                        placeholder="45000"
                        value={ventaForm.vehicle_km}
                        onChange={(e) => setVentaForm((p) => ({ ...p, vehicle_km: e.target.value }))}
                      />
                    </FieldGroup>
                  </div>
                </div>

                <Separator />

                {/* Buyer */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-pink-500" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Datos del Comprador</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FieldGroup label="Nombre completo" required>
                      <Input
                        placeholder="Juan Pérez González"
                        value={ventaForm.buyer_name}
                        onChange={(e) => setVentaForm((p) => ({ ...p, buyer_name: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="RUT">
                      <Input
                        placeholder="12.345.678-9"
                        value={ventaForm.buyer_rut}
                        onChange={(e) => setVentaForm((p) => ({ ...p, buyer_rut: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Teléfono">
                      <Input
                        placeholder="+56 9 1234 5678"
                        value={ventaForm.buyer_phone}
                        onChange={(e) => setVentaForm((p) => ({ ...p, buyer_phone: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Correo electrónico">
                      <Input
                        type="email"
                        placeholder="juan@email.com"
                        value={ventaForm.buyer_email}
                        onChange={(e) => setVentaForm((p) => ({ ...p, buyer_email: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Dirección">
                      <Input
                        placeholder="Av. Principal 123, Santiago"
                        value={ventaForm.buyer_address}
                        onChange={(e) => setVentaForm((p) => ({ ...p, buyer_address: e.target.value }))}
                        className="col-span-2"
                      />
                    </FieldGroup>
                  </div>
                </div>

                <Separator />

                {/* Financial */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-pink-500" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Condiciones Económicas</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FieldGroup label="Precio de venta (CLP)" required>
                      <Input
                        type="number"
                        placeholder="15000000"
                        value={ventaForm.sale_price}
                        onChange={(e) => setVentaForm((p) => ({ ...p, sale_price: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Forma de pago">
                      <Select
                        value={ventaForm.payment_method}
                        onValueChange={(v) => setVentaForm((p) => ({ ...p, payment_method: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia bancaria</SelectItem>
                          <SelectItem value="credito">Crédito automotriz</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="mixto">Pago mixto</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>
                </div>

                <FieldGroup label="Observaciones">
                  <Textarea
                    placeholder="Condiciones adicionales, acuerdos especiales..."
                    rows={3}
                    value={ventaForm.notes}
                    onChange={(e) => setVentaForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </FieldGroup>

                <div className="flex justify-end gap-3 pt-2 flex-wrap">
                  <Button variant="outline" onClick={closeForm}>
                    Cancelar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleSaveVenta(true)}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar borrador"}
                  </Button>
                  <Button
                    onClick={() => handleSaveVenta(false)}
                    disabled={saving}
                    className="bg-pink-600 hover:bg-pink-700 text-white gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    {saving ? "Generando..." : editingDocId ? "Actualizar contrato" : "Generar contrato"}
                  </Button>
                </div>
              </TabsContent>

              {/* ─── CONSIGNACIÓN FORM ─── */}
              <TabsContent value="contrato_consignacion" className="mt-0 space-y-6">
                {/* Vehicle */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Car className="h-4 w-4 text-pink-500" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Datos del Vehículo</span>
                  </div>
                  <FieldGroup label="Desde inventario">
                    <InventoryVehiclePicker
                      branchId={user?.branch_id}
                      value={consignacionForm.vehicle_id}
                      onSelect={onConsignacionVehicleSelect}
                    />
                  </FieldGroup>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <FieldGroup label="Marca" required>
                      <Input
                        placeholder="Toyota"
                        value={consignacionForm.vehicle_make}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_make: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Modelo">
                      <Input
                        placeholder="Corolla"
                        value={consignacionForm.vehicle_model}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_model: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Año">
                      <Input
                        type="number"
                        placeholder="2022"
                        value={consignacionForm.vehicle_year}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_year: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Color">
                      <Input
                        placeholder="Blanco"
                        value={consignacionForm.vehicle_color}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_color: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Patente">
                      <Input
                        placeholder="ABCD12"
                        className="uppercase"
                        value={consignacionForm.vehicle_patente}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_patente: e.target.value.toUpperCase() }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="VIN / N° Motor">
                      <Input
                        placeholder="VIN123456"
                        value={consignacionForm.vehicle_vin}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_vin: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Kilometraje">
                      <Input
                        type="number"
                        placeholder="45000"
                        value={consignacionForm.vehicle_km}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, vehicle_km: e.target.value }))}
                      />
                    </FieldGroup>
                  </div>
                </div>

                <Separator />

                {/* Owner */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-pink-500" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Datos del Propietario / Consignante</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FieldGroup label="Nombre completo" required>
                      <Input
                        placeholder="Ana García López"
                        value={consignacionForm.owner_name}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, owner_name: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="RUT">
                      <Input
                        placeholder="15.678.901-2"
                        value={consignacionForm.owner_rut}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, owner_rut: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Teléfono">
                      <Input
                        placeholder="+56 9 8765 4321"
                        value={consignacionForm.owner_phone}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, owner_phone: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Correo electrónico">
                      <Input
                        type="email"
                        placeholder="ana@email.com"
                        value={consignacionForm.owner_email}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, owner_email: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Dirección">
                      <Input
                        placeholder="Calle Los Olivos 456, Santiago"
                        value={consignacionForm.owner_address}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, owner_address: e.target.value }))}
                      />
                    </FieldGroup>
                  </div>
                </div>

                <Separator />

                {/* Financial */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-pink-500" />
                    <span className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Condiciones Económicas</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FieldGroup label="Precio de venta acordado (CLP)" required>
                      <Input
                        type="number"
                        placeholder="12000000"
                        value={consignacionForm.sale_price}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, sale_price: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Comisión SkaléMotors (%)">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={consignacionForm.commission_percentage}
                        onChange={(e) => setConsignacionForm((p) => ({ ...p, commission_percentage: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="Monto comisión (calculado)">
                      <Input
                        readOnly
                        value={
                          consignacionForm.sale_price && consignacionForm.commission_percentage
                            ? formatCLP(
                                Math.round(
                                  (parseFloat(consignacionForm.sale_price) *
                                    parseFloat(consignacionForm.commission_percentage)) /
                                    100
                                )
                              )
                            : "$0"
                        }
                        className="bg-slate-50 dark:bg-zinc-800 text-slate-500 cursor-not-allowed"
                      />
                    </FieldGroup>
                  </div>
                </div>

                <FieldGroup label="Observaciones">
                  <Textarea
                    placeholder="Condiciones adicionales de la consignación..."
                    rows={3}
                    value={consignacionForm.notes}
                    onChange={(e) => setConsignacionForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </FieldGroup>

                <div className="flex justify-end gap-3 pt-2 flex-wrap">
                  <Button variant="outline" onClick={closeForm}>
                    Cancelar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleSaveConsignacion(true)}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar borrador"}
                  </Button>
                  <Button
                    onClick={() => handleSaveConsignacion(false)}
                    disabled={saving}
                    className="bg-pink-600 hover:bg-pink-700 text-white gap-2"
                  >
                    <ScrollText className="h-4 w-4" />
                    {saving ? "Generando..." : editingDocId ? "Actualizar contrato" : "Generar contrato"}
                  </Button>
                </div>
              </TabsContent>

            </div>

            <div className="lg:sticky lg:top-4 h-fit">
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mb-2 flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                Vista previa en vivo
              </p>
              <div className="bg-white text-black p-6 border border-gray-200 rounded-lg max-h-[70vh] overflow-y-auto shadow-inner">
                <DocumentContractBody doc={livePreviewDoc} issuerName={issuerName ?? undefined} compact />
              </div>
            </div>
            </div>
            </CardContent>
          </Card>
        )}

        {/* ── List ── */}
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por N° doc, nombre, patente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as DocumentStatus | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="generado">Generado</SelectItem>
                <SelectItem value="firmado">Firmado</SelectItem>
                <SelectItem value="anulado">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="contrato_venta" className="mt-0">
            <DocumentsTable
              docs={filteredDocs}
              loading={loading}
              onPreview={setPreviewDoc}
              onEdit={openEdit}
              onDelete={setDeleteId}
              onStatusChange={handleStatusChange}
              type="contrato_venta"
            />
          </TabsContent>
          <TabsContent value="contrato_consignacion" className="mt-0">
            <DocumentsTable
              docs={filteredDocs}
              loading={loading}
              onPreview={setPreviewDoc}
              onEdit={openEdit}
              onDelete={setDeleteId}
              onStatusChange={handleStatusChange}
              type="contrato_consignacion"
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Preview dialog */}
      {previewDoc && (
        <Dialog open onOpenChange={() => setPreviewDoc(null)}>
          <DocumentPreview doc={previewDoc} issuerName={issuerName ?? undefined} />
        </Dialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El contrato será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Documents Table ────────────────────────────────────────────────────────────

interface TableProps {
  docs: Document[];
  loading: boolean;
  type: DocumentType;
  onPreview: (d: Document) => void;
  onEdit: (d: Document) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: DocumentStatus) => void;
}

function DocumentsTable({ docs, loading, type, onPreview, onEdit, onDelete, onStatusChange }: TableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-zinc-500 gap-3">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">
          No hay contratos de {type === "contrato_venta" ? "venta" : "consignación"} todavía
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-zinc-800/60">
            <TableHead className="font-semibold text-xs">N° Documento</TableHead>
            <TableHead className="font-semibold text-xs">
              {type === "contrato_venta" ? "Comprador" : "Propietario"}
            </TableHead>
            <TableHead className="font-semibold text-xs">Vehículo</TableHead>
            <TableHead className="font-semibold text-xs">
              {type === "contrato_venta" ? "Precio" : "Precio / Comisión"}
            </TableHead>
            <TableHead className="font-semibold text-xs">Estado</TableHead>
            <TableHead className="font-semibold text-xs">Fecha</TableHead>
            <TableHead className="font-semibold text-xs text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => (
            <TableRow
              key={doc.id}
              className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
            >
              <TableCell className="font-mono text-xs font-semibold text-pink-600 dark:text-pink-400">
                {doc.document_number ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                <p className="font-medium text-slate-800 dark:text-zinc-200">
                  {type === "contrato_venta" ? doc.buyer_name : doc.owner_name}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  {type === "contrato_venta" ? doc.buyer_rut : doc.owner_rut}
                </p>
              </TableCell>
              <TableCell className="text-sm">
                <p className="font-medium">
                  {[doc.vehicle_make, doc.vehicle_model, doc.vehicle_year].filter(Boolean).join(" ")}
                </p>
                <p className="text-xs text-slate-400">{doc.vehicle_patente ?? ""}</p>
              </TableCell>
              <TableCell className="text-sm">
                <p className="font-semibold text-slate-700 dark:text-zinc-300">
                  {formatCLP(doc.sale_price)}
                </p>
                {type === "contrato_consignacion" && doc.commission_percentage && (
                  <p className="text-xs text-slate-400">
                    Comisión {doc.commission_percentage}% = {formatCLP(doc.commission_amount)}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={doc.status}
                  onValueChange={(v) => onStatusChange(doc.id, v as DocumentStatus)}
                >
                  <SelectTrigger className="h-7 text-xs w-32 border-0 p-0 focus:ring-0 bg-transparent">
                    <Badge
                      variant={STATUS_VARIANTS[doc.status]}
                      className="gap-1 cursor-pointer text-xs"
                    >
                      {STATUS_ICONS[doc.status]}
                      {STATUS_LABELS[doc.status]}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as DocumentStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2 text-xs">
                          {STATUS_ICONS[s]}
                          {STATUS_LABELS[s]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-xs text-slate-500 dark:text-zinc-500">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40"
                    onClick={() => onEdit(doc)}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40"
                    onClick={() => onPreview(doc)}
                    title="Vista previa"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    onClick={() => onDelete(doc.id)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
