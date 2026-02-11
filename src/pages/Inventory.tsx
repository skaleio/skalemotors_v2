import { Download, Edit, Eye, Globe, Loader2, MoreHorizontal, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useVehicles";
import { formatCLP } from "@/lib/format";
import { vehicleService } from "@/lib/services/vehicles";
import {
  listListingsForBranch,
  listConnections,
  publishVehicle,
  type MarketplacePlatform,
  type VehicleListingRow,
} from "@/lib/services/marketplaceApi";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

const statusColors = {
  disponible: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  reservado: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  vendido: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
  en_reparacion: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  fuera_de_servicio: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
};

const statusLabels = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  en_reparacion: "En reparación",
  fuera_de_servicio: "Fuera de servicio",
};

const typeLabels = {
  nuevo: "Nuevo",
  usado: "Usado",
  consignado: "Consignado"
};

// Funciones helper para formatear números con puntos (formato chileno)
const formatNumberInput = (value: string): string => {
  try {
    // Remover todo excepto números y puntos
    const cleaned = value.replace(/[^\d.]/g, '');
    // Asegurar que solo haya un punto
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  } catch (error) {
    console.error('Error en formatNumberInput:', error);
    return '';
  }
};

const parseNumberInput = (value: string): number => {
  try {
    // Remover puntos y convertir a número
    const cleaned = value.replace(/\./g, '');
    const parsed = parseFloat(cleaned);
    // Validar que sea un número válido
    if (isNaN(parsed) || !isFinite(parsed)) {
      return 0;
    }
    return parsed;
  } catch (error) {
    console.error('Error en parseNumberInput:', error);
    return 0;
  }
};

const formatNumberDisplay = (value: number): string => {
  try {
    // Validar que sea un número válido
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return '';
    }
    if (value === 0) return '';
    // Formatear con puntos como separadores de miles
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } catch (error) {
    console.error('Error en formatNumberDisplay:', error);
    return '';
  }
};

const generateVin = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
  const raw = `SK${ts}${rnd}`.replace(/[^A-Z0-9]/g, '');
  return raw.substring(0, 17).padEnd(17, '0');
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const optimizeVehicleImage = async (file: File) => {
  try {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      image.src = objectUrl;
    });

    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return file;
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    URL.revokeObjectURL(objectUrl);

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob(
        (result) => resolve(result || file),
        "image/webp",
        0.82,
      );
    });

    return new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
  } catch (error) {
    console.warn("⚠️ No se pudo optimizar la imagen, usando original:", error);
    return file;
  }
};

const uploadVehicleImage = async (
  file: File,
  fileName: string,
  accessToken: string,
) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan variables de entorno de Supabase");
  }

  if (!allowedImageTypes.includes(file.type)) {
    throw new Error(`Formato no permitido: ${file.type || "desconocido"}`);
  }

  const optimizedFile = await optimizeVehicleImage(file);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/vehicles/${fileName}`, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": optimizedFile.type,
      "x-upsert": "false",
    },
    body: optimizedFile,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Error subiendo imagen (${response.status}): ${errorBody || response.statusText}`);
  }
};

const updateVehicleImages = async (
  vehicleId: string,
  imageUrls: string[],
  accessToken: string,
) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan variables de entorno de Supabase");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${vehicleId}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ images: imageUrls }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Error actualizando imágenes (${response.status}): ${errorBody || response.statusText}`);
  }
};

export default function Inventory() {
  const { user, session } = useAuth();
  const { vehicles, loading, refetch } = useVehicles({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user?.branch_id,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedMake, setSelectedMake] = useState<string>("all");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);
  const [vehicleToSell, setVehicleToSell] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "filtered">("all");
  const [exportDetail, setExportDetail] = useState<"basic" | "full">("full");
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("xlsx");
  const [exportFileName, setExportFileName] = useState(() => {
    const fileDate = new Date().toISOString().split("T")[0];
    return `inventario_${fileDate}`;
  });
  const [hasRetriedEmpty, setHasRetriedEmpty] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [saleData, setSaleData] = useState({
    salePrice: 0,
    downPayment: 0,
    paymentMethod: 'contado',
    notes: ''
  });
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    year: 0,
    color: "",
    mileage: 0,
    category: "nuevo" as "nuevo" | "usado" | "consignado",
    price: 0,
    cost: 0,
    minDownPayment: 0,
    engine_size: "",
    fuel_type: "gasolina" as "gasolina" | "diesel" | "híbrido" | "eléctrico",
    transmission: "automático" as "manual" | "automático" | "cvt",
    location: "",
    drivetrain: "",
    images: [] as File[],
  });

  const [listingsByVehicle, setListingsByVehicle] = useState<Record<string, VehicleListingRow[]>>({});
  const [marketplaceConnections, setMarketplaceConnections] = useState<{ platform: MarketplacePlatform }[]>([]);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);

  const branchId = user?.branch_id ?? null;

  useEffect(() => {
    if (!branchId || !vehicles.length) {
      setListingsByVehicle({});
      setMarketplaceConnections([]);
      return;
    }
    const vehicleIds = vehicles.map((v) => v.id);
    listListingsForBranch(vehicleIds)
      .then((listings) => {
        const byVehicle: Record<string, VehicleListingRow[]> = {};
        for (const l of listings) {
          if (!byVehicle[l.vehicle_id]) byVehicle[l.vehicle_id] = [];
          byVehicle[l.vehicle_id].push(l);
        }
        setListingsByVehicle(byVehicle);
      })
      .catch(() => setListingsByVehicle({}));
    listConnections(branchId)
      .then((conns) => setMarketplaceConnections(conns.filter((c) => c.status === "active").map((c) => ({ platform: c.platform }))))
      .catch(() => setMarketplaceConnections([]));
  }, [branchId, vehicles]);

  const handlePublishToPlatform = async (vehicleId: string, platform: MarketplacePlatform) => {
    const key = `${vehicleId}:${platform}`;
    setPublishingKey(key);
    try {
      await publishVehicle(vehicleId, platform);
      const name = platform === "mercadolibre" ? "Mercado Libre" : platform === "facebook" ? "Facebook" : "Chile Autos";
      toast({ title: "Publicado", description: `Vehículo publicado en ${name}.` });
      const listings = await listListingsForBranch([vehicleId]);
      setListingsByVehicle((prev) => {
        const byVehicle = { ...prev };
        byVehicle[vehicleId] = listings;
        return byVehicle;
      });
    } catch (e) {
      toast({
        title: "Error al publicar",
        description: e instanceof Error ? e.message : "No se pudo publicar en la plataforma.",
        variant: "destructive",
      });
    } finally {
      setPublishingKey(null);
    }
  };

  const isFilterActive =
    searchQuery.trim() !== "" ||
    selectedStatus !== "all" ||
    selectedType !== "all" ||
    selectedMake !== "all";

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesSearch =
        searchQuery === "" ||
        vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle.vin || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === "all" || vehicle.status === selectedStatus;
      const matchesType = selectedType === "all" || vehicle.category === selectedType;
      const matchesMake = selectedMake === "all" || vehicle.make === selectedMake;
      return matchesSearch && matchesStatus && matchesType && matchesMake;
    });
  }, [vehicles, searchQuery, selectedMake, selectedStatus, selectedType]);

  useEffect(() => {
    if (!user?.branch_id) return;
    refetch();
    setHasRetriedEmpty(false);
  }, [user?.branch_id, refetch]);

  useEffect(() => {
    if (!user?.branch_id || loading) return;
    if (vehicles.length > 0) return;
    if (hasRetriedEmpty) return;
    setHasRetriedEmpty(true);
    refetch();
  }, [user?.branch_id, loading, vehicles.length, hasRetriedEmpty, refetch]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "true") {
      setShowAddDialog(true);
    }
  }, [location.search]);

  useEffect(() => {
    const handleOpenNewVehicleForm = () => setShowAddDialog(true);
    window.addEventListener("openNewVehicleForm", handleOpenNewVehicleForm);
    return () => window.removeEventListener("openNewVehicleForm", handleOpenNewVehicleForm);
  }, []);

  const uniqueMakes = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.make))).sort();
  }, [vehicles]);

  const totalValue = filteredVehicles.reduce((sum, v) => sum + Number(v.price || 0), 0);
  const totalMargin = filteredVehicles.reduce((sum, v) => sum + Number(v.margin || 0), 0);

  const selectedVehicleComputed = useMemo(() => {
    if (!selectedVehicle) return null;
    const margin = Number(selectedVehicle.margin ?? 0);
    const price = Number(selectedVehicle.price ?? 0);
    const minDownPayment = Math.round(price * 0.2);
    const engine = selectedVehicle.engine_size || "—";

    return {
      margin,
      minDownPayment,
      engine,
      ownership: selectedVehicle.category === "consignado" ? "Consignado" : "Propio",
      location: selectedVehicle.location || "—",
      drivetrain: "—",
      trunkCapacityLiters: "—",
      sunroof: "—",
    };
  }, [selectedVehicle]);

  // Pre-llenar formulario cuando se selecciona un vehículo para editar
  useEffect(() => {
    if (vehicleToEdit) {
      const features = (vehicleToEdit.features as any) || {};
      setNewVehicle({
        make: vehicleToEdit.make || "",
        model: vehicleToEdit.model || "",
        year: vehicleToEdit.year || new Date().getFullYear(),
        color: vehicleToEdit.color || "",
        mileage: vehicleToEdit.mileage || 0,
        category: vehicleToEdit.category || "nuevo",
        price: Number(vehicleToEdit.price || 0),
        cost: Number(vehicleToEdit.cost || 0),
        minDownPayment: Number(features.min_down_payment || 0),
        engine_size: vehicleToEdit.engine_size || "",
        fuel_type: vehicleToEdit.fuel_type || "gasolina",
        transmission: vehicleToEdit.transmission || "automático",
        location: vehicleToEdit.location || "",
        drivetrain: features.drivetrain || "",
        images: [], // Las imágenes existentes se mantienen en el vehículo, solo se pueden agregar nuevas
      });
    }
  }, [vehicleToEdit]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    setNewVehicle((prev) => ({
      ...prev,
      images: [...prev.images, ...fileArray],
    }));
  };

  const removeImage = (index: number) => {
    setNewVehicle((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleCreateVehicle = async () => {
    if (!user?.branch_id) {
      alert("Error: No hay sucursal asignada. Por favor contacta al administrador.");
      console.error("No hay sucursal asignada");
      return;
    }

    // Validar campos requeridos
    if (!newVehicle.make || !newVehicle.model || !newVehicle.color || !newVehicle.year || newVehicle.year === 0) {
      alert("Por favor completa todos los campos requeridos (marcados con *)");
      return;
    }

    setIsSaving(true);
    try {
      console.log("🔄 Iniciando creación de vehículo...");
      console.log("📋 Datos del formulario:", {
        make: newVehicle.make,
        model: newVehicle.model,
        year: newVehicle.year,
        hasImages: newVehicle.images.length > 0
      });

      // Calcular margen
      const margin = newVehicle.price - newVehicle.cost;
      const minDownPayment = newVehicle.minDownPayment || 0;

      // Preparar features con campos adicionales
      const features = {
        drivetrain: newVehicle.drivetrain || null,
        min_down_payment: minDownPayment,
      };

      // Crear el vehículo primero (sin imágenes)
      // Asegurar que los números sean del tipo correcto para Supabase
      const vinToCreate = generateVin();
      const vehicleData = {
        vin: vinToCreate,
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        year: Number(newVehicle.year),
        color: newVehicle.color.trim(),
        mileage: newVehicle.mileage ? Number(newVehicle.mileage) : null,
        fuel_type: newVehicle.fuel_type,
        transmission: newVehicle.transmission,
        engine_size: newVehicle.engine_size?.trim() || null,
        category: newVehicle.category,
        price: Number(newVehicle.price),
        cost: newVehicle.cost ? Number(newVehicle.cost) : null,
        margin: Number(margin),
        status: "disponible" as const,
        branch_id: user.branch_id,
        location: newVehicle.location?.trim() || null,
        images: [], // Inicialmente vacío, se llenará después de subir las imágenes
        features: features as any,
      };

      console.log("📝 Datos del vehículo a crear:", vehicleData);
      console.log("📝 Validando datos antes de enviar...");

      // Validar que todos los campos requeridos estén presentes
      if (!vehicleData.make || !vehicleData.model || !vehicleData.color || !vehicleData.year) {
        throw new Error("Faltan campos requeridos en los datos del vehículo");
      }

      console.log("✅ Validación pasada, enviando a Supabase...");

      // Crear vehículo (incluye timeout interno y verificación)
      const createdVehicle = await vehicleService.create(vehicleData, {
        accessToken: session?.access_token
      }) as any;
      console.log("✅ Vehículo creado exitosamente con ID:", createdVehicle.id);

      // Subir imágenes a Supabase Storage
      if (newVehicle.images.length > 0) {
        console.log(`📸 Subiendo ${newVehicle.images.length} imagen(es)...`);
        const imageUrls: string[] = [];
        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error("No hay sesión activa para subir imágenes.");
        }

        for (const file of newVehicle.images) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${createdVehicle.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            console.log(`📤 Subiendo imagen: ${fileName}`);
            await uploadVehicleImage(file, fileName, accessToken);

            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
              .from('vehicles')
              .getPublicUrl(fileName);

            imageUrls.push(publicUrl);
            console.log(`✅ Imagen subida: ${publicUrl}`);
          } catch (error) {
            console.error("❌ Error procesando imagen:", error);
          }
        }

        // Actualizar vehículo con las URLs de las imágenes
        if (imageUrls.length > 0) {
          console.log(`🔄 Actualizando vehículo con ${imageUrls.length} imagen(es)...`);
          try {
            await updateVehicleImages(createdVehicle.id, imageUrls, accessToken);
            console.log(`✅ ${imageUrls.length} imagen(es) agregada(s) al vehículo`);
          } catch (updateError: any) {
            console.error("❌ Error actualizando vehículo con imágenes:", updateError);
            // No lanzar error, el vehículo ya fue creado
            // Las imágenes se pueden agregar después manualmente
          }
        } else {
          console.warn("⚠️ No se pudieron subir las imágenes");
        }
      } else {
        console.log("ℹ️ No hay imágenes para subir");
      }

      // Cerrar diálogo primero
      setShowAddDialog(false);

      // Resetear formulario
      setNewVehicle({
        make: "",
        model: "",
        year: 0,
        color: "",
        mileage: 0,
        category: "nuevo",
        price: 0,
        cost: 0,
        minDownPayment: 0,
        engine_size: "",
        fuel_type: "gasolina",
        transmission: "automático",
        location: "",
        drivetrain: "",
        images: [],
      });

      console.log("✅ Vehículo guardado exitosamente");

      // Refetch con timeout para evitar que se quede colgado
      // Usar un solo refetch con manejo robusto de errores
      try {
        const refetchPromise = refetch();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout en refetch')), 8000)
        );

        await Promise.race([refetchPromise, timeoutPromise]);
        console.log("✅ Lista actualizada correctamente");
      } catch (refetchError: any) {
        console.warn("⚠️ Error o timeout en refetch, pero el vehículo fue creado:", refetchError);
        // Intentar refetch en segundo plano sin bloquear
        setTimeout(() => {
          refetch().catch(err => {
            console.error("Error en refetch manual:", err);
            // No hacer nada más, el vehículo ya fue creado
          });
        }, 500);
      }
    } catch (error: any) {
      console.error("❌ Error creando vehículo:", error);
      console.error("Detalles del error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      // Mensaje de error más claro para el usuario
      let errorMessage = error?.message || "Error desconocido al crear el vehículo";

      // Si el error es sobre permisos o sesión
      if (errorMessage.includes("sesión") || errorMessage.includes("permisos")) {
        errorMessage = "Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.";
      }

      alert(`Error al crear vehículo:\n\n${errorMessage}\n\nSi el problema persiste, contacta al administrador.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!vehicleToEdit || !user?.branch_id) {
      alert("Error: No hay vehículo seleccionado o sucursal asignada.");
      return;
    }

    // Validar campos requeridos
    if (!newVehicle.make || !newVehicle.model || !newVehicle.color || !newVehicle.year || newVehicle.year === 0) {
      alert("Por favor completa todos los campos requeridos (marcados con *)");
      return;
    }

    setIsSaving(true);
    try {
      console.log("🔄 Iniciando actualización de vehículo...");

      // Calcular margen
      const margin = newVehicle.price - newVehicle.cost;
      const minDownPayment = newVehicle.minDownPayment || 0;

      // Preparar features con campos adicionales
      const features = {
        drivetrain: newVehicle.drivetrain || null,
        min_down_payment: minDownPayment,
      };

      // Preparar datos de actualización
      const updateData = {
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        year: parseInt(String(newVehicle.year), 10),
        color: newVehicle.color.trim(),
        mileage: newVehicle.mileage ? Number(newVehicle.mileage) : null,
        fuel_type: newVehicle.fuel_type,
        transmission: newVehicle.transmission,
        engine_size: newVehicle.engine_size?.trim() || null,
        category: newVehicle.category,
        price: Number(newVehicle.price),
        cost: newVehicle.cost ? Number(newVehicle.cost) : null,
        margin: Number(margin),
        location: newVehicle.location?.trim() || null,
        features: features as any,
      };

      console.log("📝 Datos del vehículo a actualizar:", updateData);

      // Actualizar vehículo
      await vehicleService.update(vehicleToEdit.id, updateData);
      console.log("✅ Vehículo actualizado exitosamente");

      // Si hay nuevas imágenes, subirlas
      if (newVehicle.images.length > 0) {
        console.log(`📸 Subiendo ${newVehicle.images.length} imagen(es) nuevas...`);
        const imageUrls: string[] = [];
        const existingImages = (vehicleToEdit.images as unknown as string[] | null) || [];

        for (const file of newVehicle.images) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${vehicleToEdit.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            console.log(`📤 Subiendo imagen: ${fileName}`);
            const optimizedFile = await optimizeVehicleImage(file);
            const { error: uploadError } = await supabase.storage
              .from('vehicles')
              .upload(fileName, optimizedFile, {
                cacheControl: '3600',
                upsert: false,
                contentType: optimizedFile.type,
              });

            if (uploadError) {
              console.error("❌ Error subiendo imagen:", uploadError);
              continue;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('vehicles')
              .getPublicUrl(fileName);

            imageUrls.push(publicUrl);
            console.log(`✅ Imagen subida: ${publicUrl}`);
          } catch (error) {
            console.error("❌ Error procesando imagen:", error);
          }
        }

        // Actualizar vehículo con las nuevas URLs de las imágenes
        if (imageUrls.length > 0) {
          const allImages = [...existingImages, ...imageUrls];
          await vehicleService.update(vehicleToEdit.id, { images: allImages as any });
          console.log(`✅ ${imageUrls.length} imagen(es) agregada(s) al vehículo`);
        }
      }

      // Cerrar diálogo y resetear
      setVehicleToEdit(null);
      setNewVehicle({
        make: "",
        model: "",
        year: 0,
        color: "",
        mileage: 0,
        category: "nuevo",
        price: 0,
        cost: 0,
        minDownPayment: 0,
        engine_size: "",
        fuel_type: "gasolina",
        transmission: "automático",
        location: "",
        drivetrain: "",
        images: [],
      });

      console.log("✅ Vehículo actualizado exitosamente");

      // Refetch con timeout
      try {
        await Promise.race([
          refetch(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout en refetch')), 10000)
          )
        ]);
        console.log("✅ Lista actualizada correctamente");
      } catch (refetchError) {
        console.warn("⚠️ Error o timeout en refetch:", refetchError);
        setTimeout(() => {
          refetch().catch(err => console.error("Error en refetch manual:", err));
        }, 1000);
      }
    } catch (error: any) {
      console.error("❌ Error actualizando vehículo:", error);
      console.error("Detalles del error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      alert(`Error al actualizar vehículo: ${error?.message || "Error desconocido"}\n\nRevisa la consola para más detalles.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete || !user) {
      setVehicleToDelete(null);
      setIsDeleting(false);
      return;
    }

    const vehicleToDeleteCopy = vehicleToDelete;

    // Cerrar el diálogo y limpiar estado inmediatamente
    setVehicleToDelete(null);
    setIsDeleting(true);

    // Usar requestAnimationFrame para asegurar que el DOM se actualice antes de la operación
    requestAnimationFrame(async () => {
      try {
        await vehicleService.delete(vehicleToDeleteCopy.id);
        console.log(`✅ Vehículo eliminado: ${vehicleToDeleteCopy.make} ${vehicleToDeleteCopy.model}`);
      } catch (error: any) {
        console.error("Error eliminando vehículo:", error);
      } finally {
        // Limpiar estado de loading
        setIsDeleting(false);

        // Refrescar la lista después de que todo se haya limpiado
        setTimeout(() => {
          refetch();
        }, 100);
      }
    });
  };

  const handleSellVehicle = async () => {
    if (!vehicleToSell || !user?.branch_id) {
      alert("Error: No hay vehículo seleccionado o sucursal asignada.");
      return;
    }

    if (saleData.salePrice <= 0) {
      alert("Por favor ingresa un precio de venta válido");
      return;
    }

    setIsSaving(true);
    try {
      console.log('🔄 Registrando venta...');

      const margin = saleData.salePrice - Number(vehicleToSell.cost || 0);
      const commission = margin * 0.15; // 15% de comisión sobre el margen

      // Crear la venta
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          vehicle_id: vehicleToSell.id,
          seller_id: user.id,
          branch_id: user.branch_id,
          sale_price: saleData.salePrice,
          down_payment: saleData.downPayment,
          financing_amount: saleData.salePrice - saleData.downPayment,
          margin: margin,
          commission: commission,
          status: 'completada',
          sale_date: new Date().toISOString().split('T')[0],
          payment_method: saleData.paymentMethod,
          notes: saleData.notes
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Actualizar el estado del vehículo a vendido
      await vehicleService.update(vehicleToSell.id, { status: 'vendido' });

      console.log('✅ Venta registrada exitosamente');

      // Cerrar diálogo y resetear
      setVehicleToSell(null);
      setSaleData({
        salePrice: 0,
        downPayment: 0,
        paymentMethod: 'contado',
        notes: ''
      });

      // Refrescar lista
      setTimeout(() => {
        refetch();
      }, 100);

      alert('¡Venta registrada exitosamente! 🎉');
    } catch (error: any) {
      console.error('❌ Error registrando venta:', error);
      alert(`Error al registrar venta: ${error?.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const buildExportRows = (vehiclesToExport: Vehicle[], detail: "basic" | "full") => {
    if (detail === "basic") {
      return vehiclesToExport.map((vehicle) => ({
        Marca: vehicle.make || "",
        Modelo: vehicle.model || "",
        Año: vehicle.year || "",
        Estado: statusLabels[vehicle.status] || vehicle.status || "",
        Tipo: typeLabels[vehicle.category] || vehicle.category || "",
        Precio: Number(vehicle.price || 0),
      }));
    }

    return vehiclesToExport.map((vehicle) => ({
      ID: vehicle.id,
      Marca: vehicle.make || "",
      Modelo: vehicle.model || "",
      Año: vehicle.year || "",
      Color: vehicle.color || "",
      Kilometraje: vehicle.mileage ?? "",
      Tipo: typeLabels[vehicle.category] || vehicle.category || "",
      Estado: statusLabels[vehicle.status] || vehicle.status || "",
      Precio: Number(vehicle.price || 0),
      Costo: Number(vehicle.cost || 0),
      Margen: Number(vehicle.margin || 0),
      Combustible: vehicle.fuel_type || "",
      Transmisión: vehicle.transmission || "",
      Motor: vehicle.engine_size || "",
      Ubicación: vehicle.location || "",
      Sucursal: (vehicle as any)?.branches?.name || "",
      "Fecha llegada": vehicle.arrival_date
        ? new Date(vehicle.arrival_date).toLocaleDateString("es-CL")
        : "",
      Creado: vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString("es-CL") : "",
      Actualizado: vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleDateString("es-CL") : "",
    }));
  };

  const getSanitizedFileName = () => {
    const base = exportFileName
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "inventario";
    const ext = exportFormat === "csv" ? "csv" : exportFormat === "pdf" ? "pdf" : "xlsx";
    return `${base}.${ext}`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportInventory = async () => {
    if (!user?.branch_id) {
      alert("Error: No hay sucursal asignada. Por favor contacta al administrador.");
      return;
    }

    setIsExporting(true);
    try {
      const vehiclesToExport =
        exportScope === "filtered"
          ? filteredVehicles
          : await vehicleService.getAll({ branchId: user.branch_id });

      if (vehiclesToExport.length === 0) {
        alert("No hay vehículos para exportar.");
        return;
      }

      const rows = buildExportRows(vehiclesToExport, exportDetail);
      const fileName = getSanitizedFileName();

      if (exportFormat === "csv") {
        const headers = Object.keys(rows[0] || {});
        const escapeCsv = (val: unknown): string => {
          const s = String(val ?? "");
          if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        const headerLine = headers.map(escapeCsv).join(",");
        const dataLines = rows.map((r) => headers.map((h) => escapeCsv((r as Record<string, unknown>)[h])).join(","));
        const csv = [headerLine, ...dataLines].join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, fileName);
      } else if (exportFormat === "pdf") {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const headers = Object.keys(rows[0] || {});
        const body = rows.map((r) => headers.map((h) => String((r as Record<string, unknown>)[h] ?? "")));
        autoTable(doc, {
          head: [headers],
          body,
          styles: { fontSize: 7 },
          margin: { top: 10 },
        });
        doc.save(fileName);
      } else {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
        const workbookArray = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
          compression: true,
        });
        const blob = new Blob([workbookArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        if (blob.size === 0) throw new Error("El archivo XLSX quedó vacío.");
        downloadBlob(blob, fileName);
      }

      setShowExportDialog(false);
    } catch (error) {
      console.error("Error exportando inventario:", error);
      alert("No se pudo exportar el inventario. Revisa la consola para más detalles.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">
            Gestiona el stock de vehículos de tu automotora
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowExportDialog(true)}
            disabled={isExporting || !user?.branch_id}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exportando..." : "Exportar inventario"}
          </Button>
          <Button
            onClick={() => {
              // Resetear formulario antes de abrir
              setNewVehicle({
                make: "",
                model: "",
                year: 0,
                color: "",
                mileage: 0,
                category: "nuevo",
                price: 0,
                cost: 0,
                minDownPayment: 0,
                engine_size: "",
                fuel_type: "gasolina",
                transmission: "automático",
                location: "",
                drivetrain: "",
                images: [],
              });
              setShowAddDialog(true);
            }}
            className="bg-black hover:bg-gray-900 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Vehículo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo, VIN, PPU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(typeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMake} onValueChange={setSelectedMake}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {uniqueMakes.map((make) => (
              <SelectItem key={make} value={make}>{make}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Vehículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredVehicles.length}</div>
            <p className="text-xs text-muted-foreground">
              de {vehicles.length} en stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCLP(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              precio de lista
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Margen Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCLP(totalMargin)}</div>
            <p className="text-xs text-muted-foreground">
              margen proyectado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Publicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {filteredVehicles.filter(v => v.status === 'disponible').length}
            </div>
            <p className="text-xs text-muted-foreground">
              en portales activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vehículos en Stock</CardTitle>
          <CardDescription>
            {filteredVehicles.length} vehículo{filteredVehicles.length !== 1 ? 's' : ''} encontrado{filteredVehicles.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Detalles</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Margen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-[140px]">Portales</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Cargando vehículos...
                  </TableCell>
                </TableRow>
              )}
              {filteredVehicles.map((vehicle) => (
                <TableRow
                  key={vehicle.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={((vehicle.images as unknown as string[] | null)?.[0]) || "/placeholder.svg"}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <div>
                        <div className="font-medium">
                          {vehicle.make} {vehicle.model}
                        </div>
                        <div className="text-sm text-muted-foreground">{vehicle.engine_size || ""}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">{vehicle.year}</span> • {vehicle.color}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        VIN: {vehicle.vin} • {(vehicle.mileage || 0).toLocaleString()} km
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.transmission} • {vehicle.fuel_type || "—"}
                      </div>
                      {vehicle.arrival_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const arrivalDate = new Date(vehicle.arrival_date);
                            const daysDiff = Math.floor((Date.now() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysDiff === 0) return "Llegó hoy";
                            if (daysDiff === 1) return "Llegó hace 1 día";
                            if (daysDiff < 30) return `Llegó hace ${daysDiff} días`;
                            const months = Math.floor(daysDiff / 30);
                            if (months === 1) return "Llegó hace 1 mes";
                            if (months < 12) return `Llegó hace ${months} meses`;
                            const years = Math.floor(months / 12);
                            return years === 1 ? "Llegó hace 1 año" : `Llegó hace ${years} años`;
                          })()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{formatCLP(Number(vehicle.price || 0))}</div>
                      <div className="text-sm text-muted-foreground">Costo: {formatCLP(Number(vehicle.cost || 0))}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-medium ${(Number(vehicle.margin || 0)) > 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCLP(Number(vehicle.margin || 0))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Number(vehicle.price || 0) > 0 ? ((Number(vehicle.margin || 0)) / Number(vehicle.price || 0) * 100).toFixed(1) : "0.0"}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[vehicle.status]}
                    >
                      {statusLabels[vehicle.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {typeLabels[vehicle.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(listingsByVehicle[vehicle.id] ?? []).map((l) => (
                        <Badge
                          key={l.id}
                          variant={l.status === "published" ? "default" : l.status === "error" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {l.platform === "mercadolibre" ? "ML" : l.platform === "facebook" ? "FB" : "Chile"}
                          {l.status === "published" ? " ✓" : l.status === "error" ? " ✗" : ""}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver detalles"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicle(vehicle);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleToEdit(vehicle);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu onOpenChange={(open) => {
                        // Asegurar que el menú se cierre correctamente
                        if (!open) {
                          // Pequeño delay para asegurar que el estado se actualice
                          setTimeout(() => {
                            // Forzar actualización del DOM
                            requestAnimationFrame(() => {});
                          }, 0);
                        }
                      }}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onCloseAutoFocus={(e) => {
                            e.preventDefault();
                          }}
                        >
                          {vehicle.status === 'ingreso' && (
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Publicar
                            </DropdownMenuItem>
                          )}
                          {vehicle.status === 'disponible' && (
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Pausar publicación
                            </DropdownMenuItem>
                          )}
                          {marketplaceConnections.some((c) => c.platform === "mercadolibre") && vehicle.status === "disponible" && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePublishToPlatform(vehicle.id, "mercadolibre");
                              }}
                              disabled={publishingKey === `${vehicle.id}:mercadolibre`}
                            >
                              {publishingKey === `${vehicle.id}:mercadolibre` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Globe className="h-4 w-4 mr-2" />
                              )}
                              Publicar en Mercado Libre
                            </DropdownMenuItem>
                          )}
                          {marketplaceConnections.some((c) => c.platform === "facebook") && vehicle.status === "disponible" && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePublishToPlatform(vehicle.id, "facebook");
                              }}
                              disabled={publishingKey === `${vehicle.id}:facebook`}
                            >
                              {publishingKey === `${vehicle.id}:facebook` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Globe className="h-4 w-4 mr-2" />
                              )}
                              Publicar en Facebook
                            </DropdownMenuItem>
                          )}
                          {marketplaceConnections.some((c) => c.platform === "chileautos") && vehicle.status === "disponible" && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePublishToPlatform(vehicle.id, "chileautos");
                              }}
                              disabled={publishingKey === `${vehicle.id}:chileautos`}
                            >
                              {publishingKey === `${vehicle.id}:chileautos` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Globe className="h-4 w-4 mr-2" />
                              )}
                              Publicar en Chile Autos
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Ajustar precio
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Reservar para lead
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVehicleToSell(vehicle);
                              setSaleData({
                                salePrice: Number(vehicle.price || 0),
                                downPayment: 0,
                                paymentMethod: 'contado',
                                notes: ''
                              });
                            }}
                          >
                            Marcar como vendido
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVehicleToDelete(vehicle);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Borrar vehículo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!loading && filteredVehicles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {isFilterActive
                  ? "No se encontraron vehículos con los filtros aplicados."
                  : "Aún no hay vehículos en inventario."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de exportación */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Exportar inventario</DialogTitle>
            <DialogDescription>
              Elige el formato, alcance y nivel de detalle del archivo a exportar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="export-file-name">Nombre del archivo</Label>
              <Input
                id="export-file-name"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="Ej: inventario_febrero"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Formato</div>
              <RadioGroup
                value={exportFormat}
                onValueChange={(value) => setExportFormat(value as "csv" | "xlsx" | "pdf")}
                className="flex flex-wrap gap-4"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="csv" />
                  CSV
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="xlsx" />
                  XLSX (Excel)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="pdf" />
                  PDF
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Alcance</div>
              <RadioGroup
                value={exportScope}
                onValueChange={(value) => setExportScope(value as "all" | "filtered")}
                className="gap-3"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="all" />
                  Todo el inventario
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="filtered" />
                  Solo con filtros actuales
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Nivel de detalle</div>
              <RadioGroup
                value={exportDetail}
                onValueChange={(value) => setExportDetail(value as "basic" | "full")}
                className="gap-3"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="basic" />
                  Básico (marca, modelo, año, estado, tipo, precio)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="full" />
                  Completo (incluye costos, margen, fechas y ubicación)
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowExportDialog(false)} disabled={isExporting}>
              Cancelar
            </Button>
            <Button onClick={handleExportInventory} disabled={isExporting}>
              {isExporting ? "Exportando..." : `Exportar ${exportFormat.toUpperCase()}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Vehículo */}
      <Dialog open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Vehículo</DialogTitle>
            <DialogDescription>
              Información completa del vehículo seleccionado
            </DialogDescription>
          </DialogHeader>

          {selectedVehicle && selectedVehicleComputed && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fotos */}
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border bg-muted">
                  <img
                    src={(selectedVehicle.images as unknown as string[] | null)?.[0] || "/placeholder.svg"}
                    alt="Foto vehículo"
                    className="w-full h-[280px] object-cover"
                  />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(((selectedVehicle.images as unknown as string[] | null) ?? []).length
                    ? (selectedVehicle.images as unknown as string[])
                    : ["/placeholder.svg"])
                    .slice(0, 5)
                    .map((src, idx) => (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        className="rounded-lg overflow-hidden border hover:opacity-90"
                        onClick={() => {
                          // Cambiar imagen principal moviendo la imagen seleccionada a la primera posición
                          const base = (((selectedVehicle.images as unknown as string[] | null) ?? []).length
                            ? (selectedVehicle.images as unknown as string[])
                            : ["/placeholder.svg"]);
                          const next = [...base];
                          const picked = next[idx];
                          next.splice(idx, 1);
                          next.unshift(picked);
                          setSelectedVehicle({ ...selectedVehicle, images: next as any });
                        }}
                      >
                        <img src={src} alt="thumb" className="w-full h-14 object-cover" />
                      </button>
                    ))}
                </div>
              </div>

              {/* Ficha */}
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedVehicle.engine_size || ""}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Propio o Consignado</div>
                    <div className="font-semibold">{selectedVehicleComputed.ownership}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Valor por vender</div>
                    <div className="font-semibold">{formatCLP(Number(selectedVehicle.price || 0))}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Pie mínimo</div>
                    <div className="font-semibold">{formatCLP(selectedVehicleComputed.minDownPayment)}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Ganancia estimada</div>
                    <div className="font-semibold text-success">{formatCLP(selectedVehicleComputed.margin)}</div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="font-semibold mb-3">Características</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Kilometraje y año</div>
                      <div className="font-medium">
                          {(selectedVehicle.mileage || 0).toLocaleString()} km · {selectedVehicle.year}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Motor</div>
                      <div className="font-medium">{selectedVehicleComputed.engine}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Tipo combustible</div>
                        <div className="font-medium">{selectedVehicle.fuel_type || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Tracción</div>
                      <div className="font-medium">{selectedVehicleComputed.drivetrain}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Ubicación física</div>
                      <div className="font-medium">{selectedVehicleComputed.location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Transmisión</div>
                      <div className="font-medium">{selectedVehicle.transmission}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Capacidad de cajuela (L)</div>
                      <div className="font-medium">{selectedVehicleComputed.trunkCapacityLiters}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Techo corredizo</div>
                      <div className="font-medium">{selectedVehicleComputed.sunroof}</div>
                    </div>
                    {selectedVehicle.arrival_date && (
                      <div>
                        <div className="text-xs text-muted-foreground">Fecha de llegada</div>
                        <div className="font-medium">
                          {(() => {
                            const arrivalDate = new Date(selectedVehicle.arrival_date);
                            const formattedDate = arrivalDate.toLocaleDateString('es-CL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                            const daysDiff = Math.floor((Date.now() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
                            let timeText = "";
                            if (daysDiff === 0) timeText = " (Llegó hoy)";
                            else if (daysDiff === 1) timeText = " (Llegó hace 1 día)";
                            else if (daysDiff < 30) timeText = ` (Llegó hace ${daysDiff} días)`;
                            else {
                              const months = Math.floor(daysDiff / 30);
                              if (months === 1) timeText = " (Llegó hace 1 mes)";
                              else if (months < 12) timeText = ` (Llegó hace ${months} meses)`;
                              else {
                                const years = Math.floor(months / 12);
                                timeText = years === 1 ? " (Llegó hace 1 año)" : ` (Llegó hace ${years} años)`;
                              }
                            }
                            return `${formattedDate}${timeText}`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para agregar vehículo */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            if (location.search) {
              navigate(location.pathname, { replace: true });
            }
            setNewVehicle({
              make: "",
              model: "",
              year: 0,
              color: "",
              mileage: 0,
              category: "nuevo",
              price: 0,
              cost: 0,
              minDownPayment: 0,
              engine_size: "",
              fuel_type: "gasolina",
              transmission: "automático",
              location: "",
              drivetrain: "",
              images: [],
            });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Vehículo</DialogTitle>
            <DialogDescription>
              Completa todos los campos para agregar un vehículo al inventario
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Fotos del vehículo */}
            <div className="md:col-span-2">
              <Label htmlFor="images">Fotos del vehículo</Label>
              <div className="mt-2">
                <div className="flex flex-wrap gap-4 mb-4">
                  {newVehicle.images.map((file, index) => {
                    const imageUrl = URL.createObjectURL(file);
                    return (
                      <div key={index} className="relative">
                        <img
                          src={imageUrl}
                          alt={`Vehículo ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                          onLoad={() => URL.revokeObjectURL(imageUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="cursor-pointer"
                />
              </div>
            </div>

            {/* Nombre del vehículo (Marca) */}
            <div>
              <Label htmlFor="make">Marca *</Label>
              <Input
                id="make"
                value={newVehicle.make}
                onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                placeholder="Ej: Toyota"
                required
              />
            </div>

            {/* Modelo */}
            <div>
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                placeholder="Ej: Corolla Cross"
                required
              />
            </div>

            {/* Año */}
            <div>
              <Label htmlFor="year">Año *</Label>
              <Input
                id="year"
                type="text"
                value={newVehicle.year || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Solo números
                  if (value === '') {
                    setNewVehicle({ ...newVehicle, year: 0 });
                  } else {
                    const yearNum = parseInt(value);
                    if (!isNaN(yearNum)) {
                      setNewVehicle({ ...newVehicle, year: yearNum });
                    }
                  }
                }}
                placeholder="Ej: 2024"
                required
              />
            </div>

            {/* Color */}
            <div>
              <Label htmlFor="color">Color *</Label>
              <Input
                id="color"
                value={newVehicle.color}
                onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                placeholder="Ej: Blanco"
                required
              />
            </div>

            {/* Kilometraje */}
            <div>
              <Label htmlFor="mileage">Kilometraje</Label>
              <Input
                id="mileage"
                type="text"
                value={formatNumberDisplay(newVehicle.mileage)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando kilometraje:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 15.000"
              />
            </div>

            {/* Propio o Consignado */}
            <div>
              <Label htmlFor="category">Propio o Consignado *</Label>
              <Select
                value={newVehicle.category}
                onValueChange={(value: "nuevo" | "usado" | "consignado") =>
                  setNewVehicle({ ...newVehicle, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo (Propio)</SelectItem>
                  <SelectItem value="usado">Usado (Propio)</SelectItem>
                  <SelectItem value="consignado">Consignado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor por vender */}
            <div>
              <Label htmlFor="price">Valor por vender (CLP) *</Label>
              <Input
                id="price"
                type="text"
                value={formatNumberDisplay(newVehicle.price)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, price: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando precio:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, price: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 15.990.000"
                required
              />
            </div>

            {/* Costo */}
            <div>
              <Label htmlFor="cost">Costo (CLP)</Label>
              <Input
                id="cost"
                type="text"
                value={formatNumberDisplay(newVehicle.cost)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando costo:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 12.000.000"
              />
            </div>

            {/* Pie mínimo */}
            <div>
              <Label htmlFor="minDownPayment">Pie mínimo *</Label>
              <Input
                id="minDownPayment"
                type="text"
                value={formatNumberDisplay(newVehicle.minDownPayment)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, minDownPayment: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando pie mínimo:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, minDownPayment: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 3.000.000"
                required
              />
            </div>

            {/* Ganancia estimada (calculada) */}
            <div>
              <Label>Ganancia estimada (calculada)</Label>
              <Input
                value={formatCLP(newVehicle.price - newVehicle.cost)}
                disabled
                className="bg-gray-100 dark:bg-gray-800"
              />
            </div>

            {/* Motor */}
            <div>
              <Label htmlFor="engine_size">Motor</Label>
              <Input
                id="engine_size"
                value={newVehicle.engine_size}
                onChange={(e) => setNewVehicle({ ...newVehicle, engine_size: e.target.value })}
                placeholder="Ej: 1.8L, 2.0L"
              />
            </div>

            {/* Tipo Combustible */}
            <div>
              <Label htmlFor="fuel_type">Tipo Combustible</Label>
              <Select
                value={newVehicle.fuel_type}
                onValueChange={(value: "gasolina" | "diesel" | "híbrido" | "eléctrico") =>
                  setNewVehicle({ ...newVehicle, fuel_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="híbrido">Híbrido</SelectItem>
                  <SelectItem value="eléctrico">Eléctrico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transmisión */}
            <div>
              <Label htmlFor="transmission">Transmisión</Label>
              <Select
                value={newVehicle.transmission}
                onValueChange={(value: "manual" | "automático" | "cvt") =>
                  setNewVehicle({ ...newVehicle, transmission: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automático">Automático</SelectItem>
                  <SelectItem value="cvt">CVT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tracción */}
            <div>
              <Label htmlFor="drivetrain">Tracción</Label>
              <Select
                value={newVehicle.drivetrain || undefined}
                onValueChange={(value) => setNewVehicle({ ...newVehicle, drivetrain: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Delantera">Delantera</SelectItem>
                  <SelectItem value="Trasera">Trasera</SelectItem>
                  <SelectItem value="4WD">4WD (Tracción en las 4 ruedas)</SelectItem>
                  <SelectItem value="AWD">AWD (Tracción integral)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación Física */}
            <div>
              <Label htmlFor="location">Ubicación Física</Label>
              <Input
                id="location"
                value={newVehicle.location}
                onChange={(e) => setNewVehicle({ ...newVehicle, location: e.target.value })}
                placeholder="Ej: Patio A, Estacionamiento 3"
              />
            </div>


          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setNewVehicle({
                  make: "",
                  model: "",
                  year: 0,
                  color: "",
                  mileage: 0,
                  category: "nuevo",
                  price: 0,
                  cost: 0,
                  minDownPayment: 0,
                  engine_size: "",
                  fuel_type: "gasolina",
                  transmission: "automático",
                  location: "",
                  drivetrain: "",
                  images: [],
                });
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateVehicle}
              disabled={isSaving || !newVehicle.make || !newVehicle.model || !newVehicle.color || !newVehicle.year || newVehicle.year === 0}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {isSaving ? "Guardando..." : "Guardar Vehículo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar vehículo */}
      <Dialog
        open={!!vehicleToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setVehicleToEdit(null);
            // Resetear formulario al cerrar
            setNewVehicle({
              make: "",
              model: "",
              year: 0,
              color: "",
              mileage: 0,
              category: "nuevo",
              price: 0,
              cost: 0,
              minDownPayment: 0,
              engine_size: "",
              fuel_type: "gasolina",
              transmission: "automático",
              location: "",
              drivetrain: "",
              images: [],
            });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Vehículo</DialogTitle>
            <DialogDescription>
              Modifica los datos del vehículo {vehicleToEdit?.make} {vehicleToEdit?.model}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Fotos del vehículo */}
            <div className="md:col-span-2">
              <Label htmlFor="edit-images">Fotos del vehículo</Label>
              <div className="mt-2">
                {/* Mostrar imágenes existentes */}
                {vehicleToEdit && ((vehicleToEdit.images as unknown as string[] | null) || []).length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-4">
                    <p className="text-sm text-muted-foreground w-full">Imágenes actuales:</p>
                    {((vehicleToEdit.images as unknown as string[]) || []).map((img, index) => (
                      <div key={index} className="relative">
                        <img
                          src={img}
                          alt={`Vehículo ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {/* Mostrar nuevas imágenes seleccionadas */}
                {newVehicle.images.length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-4">
                    <p className="text-sm text-muted-foreground w-full">Nuevas imágenes a agregar:</p>
                    {newVehicle.images.map((file, index) => {
                      const imageUrl = URL.createObjectURL(file);
                      return (
                        <div key={index} className="relative">
                          <img
                            src={imageUrl}
                            alt={`Nueva ${index + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border"
                            onLoad={() => URL.revokeObjectURL(imageUrl)}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Input
                  id="edit-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Selecciona imágenes adicionales para agregar al vehículo
                </p>
              </div>
            </div>

            {/* Resto de campos - reutilizando los mismos del formulario de agregar */}
            {/* Marca */}
            <div>
              <Label htmlFor="edit-make">Marca *</Label>
              <Input
                id="edit-make"
                value={newVehicle.make}
                onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                placeholder="Ej: Toyota"
                required
              />
            </div>

            {/* Modelo */}
            <div>
              <Label htmlFor="edit-model">Modelo *</Label>
              <Input
                id="edit-model"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                placeholder="Ej: Corolla Cross"
                required
              />
            </div>

            {/* Año */}
            <div>
              <Label htmlFor="edit-year">Año *</Label>
              <Input
                id="edit-year"
                type="text"
                value={newVehicle.year || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Solo números
                  if (value === '') {
                    setNewVehicle({ ...newVehicle, year: 0 });
                  } else {
                    const yearNum = parseInt(value);
                    if (!isNaN(yearNum)) {
                      setNewVehicle({ ...newVehicle, year: yearNum });
                    }
                  }
                }}
                placeholder="Ej: 2024"
                required
              />
            </div>

            {/* Color */}
            <div>
              <Label htmlFor="edit-color">Color *</Label>
              <Input
                id="edit-color"
                value={newVehicle.color}
                onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                placeholder="Ej: Blanco"
                required
              />
            </div>

            {/* Kilometraje */}
            <div>
              <Label htmlFor="edit-mileage">Kilometraje</Label>
              <Input
                id="edit-mileage"
                type="text"
                value={formatNumberDisplay(newVehicle.mileage)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando kilometraje:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 15.000"
              />
            </div>

            {/* Propio o Consignado */}
            <div>
              <Label htmlFor="edit-category">Propio o Consignado *</Label>
              <Select
                value={newVehicle.category}
                onValueChange={(value: "nuevo" | "usado" | "consignado") =>
                  setNewVehicle({ ...newVehicle, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo (Propio)</SelectItem>
                  <SelectItem value="usado">Usado (Propio)</SelectItem>
                  <SelectItem value="consignado">Consignado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor por vender */}
            <div>
              <Label htmlFor="edit-price">Valor por vender (CLP) *</Label>
              <Input
                id="edit-price"
                type="text"
                value={formatNumberDisplay(newVehicle.price)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, price: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando precio:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, price: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 15.990.000"
                required
              />
            </div>

            {/* Costo */}
            <div>
              <Label htmlFor="edit-cost">Costo (CLP)</Label>
              <Input
                id="edit-cost"
                type="text"
                value={formatNumberDisplay(newVehicle.cost)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando costo:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 12.000.000"
              />
            </div>

            {/* Pie mínimo */}
            <div>
              <Label htmlFor="minDownPayment">Pie mínimo *</Label>
              <Input
                id="minDownPayment"
                type="text"
                value={formatNumberDisplay(newVehicle.minDownPayment)}
                onChange={(e) => {
                  try {
                    const formatted = formatNumberInput(e.target.value);
                    setNewVehicle({ ...newVehicle, minDownPayment: parseNumberInput(formatted) });
                  } catch (error) {
                    console.error('Error procesando pie mínimo:', error);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const formatted = formatNumberInput(pastedText);
                  setNewVehicle({ ...newVehicle, minDownPayment: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 3.000.000"
                required
              />
            </div>

            {/* Ganancia estimada (calculada) */}
            <div>
              <Label>Ganancia estimada (calculada)</Label>
              <Input
                value={formatCLP(newVehicle.price - newVehicle.cost)}
                disabled
                className="bg-gray-100 dark:bg-gray-800"
              />
            </div>

            {/* Motor */}
            <div>
              <Label htmlFor="edit-engine_size">Motor</Label>
              <Input
                id="edit-engine_size"
                value={newVehicle.engine_size}
                onChange={(e) => setNewVehicle({ ...newVehicle, engine_size: e.target.value })}
                placeholder="Ej: 1.8L, 2.0L"
              />
            </div>

            {/* Tipo Combustible */}
            <div>
              <Label htmlFor="edit-fuel_type">Tipo Combustible</Label>
              <Select
                value={newVehicle.fuel_type}
                onValueChange={(value: "gasolina" | "diesel" | "híbrido" | "eléctrico") =>
                  setNewVehicle({ ...newVehicle, fuel_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="híbrido">Híbrido</SelectItem>
                  <SelectItem value="eléctrico">Eléctrico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transmisión */}
            <div>
              <Label htmlFor="edit-transmission">Transmisión</Label>
              <Select
                value={newVehicle.transmission}
                onValueChange={(value: "manual" | "automático" | "cvt") =>
                  setNewVehicle({ ...newVehicle, transmission: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automático">Automático</SelectItem>
                  <SelectItem value="cvt">CVT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tracción */}
            <div>
              <Label htmlFor="edit-drivetrain">Tracción</Label>
              <Select
                value={newVehicle.drivetrain || undefined}
                onValueChange={(value) => setNewVehicle({ ...newVehicle, drivetrain: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Delantera">Delantera</SelectItem>
                  <SelectItem value="Trasera">Trasera</SelectItem>
                  <SelectItem value="4WD">4WD (Tracción en las 4 ruedas)</SelectItem>
                  <SelectItem value="AWD">AWD (Tracción integral)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación Física */}
            <div>
              <Label htmlFor="edit-location">Ubicación Física</Label>
              <Input
                id="edit-location"
                value={newVehicle.location}
                onChange={(e) => setNewVehicle({ ...newVehicle, location: e.target.value })}
                placeholder="Ej: Patio A, Estacionamiento 3"
              />
            </div>


          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setVehicleToEdit(null);
                setNewVehicle({
                  make: "",
                  model: "",
                  year: 0,
                  color: "",
                  mileage: 0,
                  category: "nuevo",
                  price: 0,
                  cost: 0,
                  minDownPayment: 0,
                  engine_size: "",
                  fuel_type: "gasolina",
                  transmission: "automático",
                  location: "",
                  drivetrain: "",
                  images: [],
                });
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateVehicle}
              disabled={isSaving || !newVehicle.make || !newVehicle.model || !newVehicle.color || !newVehicle.year || newVehicle.year === 0}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      {vehicleToDelete && (
        <AlertDialog
          open={!!vehicleToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) {
              // Solo permitir cerrar si no está eliminando
              requestAnimationFrame(() => {
                setVehicleToDelete(null);
                setIsDeleting(false);
              });
            }
          }}
        >
          <AlertDialogContent
            onInteractOutside={(e) => {
              if (isDeleting) {
                e.preventDefault();
              }
            }}
            onEscapeKeyDown={(e) => {
              if (isDeleting) {
                e.preventDefault();
              }
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el vehículo{" "}
                <strong>
                  {vehicleToDelete.make} {vehicleToDelete.model} {vehicleToDelete.year}
                </strong>{" "}
                del inventario.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDeleting) {
                    requestAnimationFrame(() => {
                      setVehicleToDelete(null);
                      setIsDeleting(false);
                    });
                  }
                }}
                disabled={isDeleting}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDeleting) {
                    handleDeleteVehicle();
                  }
                }}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Dialog para registrar venta */}
      <Dialog
        open={!!vehicleToSell}
        onOpenChange={(open) => {
          if (!open) {
            setVehicleToSell(null);
            setSaleData({
              salePrice: 0,
              downPayment: 0,
              paymentMethod: 'contado',
              notes: ''
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
            <DialogDescription>
              Completa los datos de la venta de {vehicleToSell?.make} {vehicleToSell?.model} {vehicleToSell?.year}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Información del vehículo */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Información del Vehículo</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Vehículo:</span>
                  <p className="font-medium">{vehicleToSell?.make} {vehicleToSell?.model} {vehicleToSell?.year}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Precio Lista:</span>
                  <p className="font-medium">{formatCLP(Number(vehicleToSell?.price || 0))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Costo:</span>
                  <p className="font-medium">{formatCLP(Number(vehicleToSell?.cost || 0))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Margen Potencial:</span>
                  <p className="font-medium text-green-600">
                    {formatCLP(saleData.salePrice - Number(vehicleToSell?.cost || 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Precio de venta */}
            <div>
              <Label htmlFor="salePrice">Precio de Venta Final *</Label>
              <Input
                id="salePrice"
                type="text"
                value={formatNumberDisplay(saleData.salePrice)}
                onChange={(e) => {
                  const formatted = formatNumberInput(e.target.value);
                  setSaleData({ ...saleData, salePrice: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 15.990.000"
                required
              />
            </div>

            {/* Pie */}
            <div>
              <Label htmlFor="downPayment">Pie / Anticipo</Label>
              <Input
                id="downPayment"
                type="text"
                value={formatNumberDisplay(saleData.downPayment)}
                onChange={(e) => {
                  const formatted = formatNumberInput(e.target.value);
                  setSaleData({ ...saleData, downPayment: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 3.000.000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Monto financiado: {formatCLP(saleData.salePrice - saleData.downPayment)}
              </p>
            </div>

            {/* Método de pago */}
            <div>
              <Label htmlFor="paymentMethod">Método de Pago</Label>
              <Select
                value={saleData.paymentMethod}
                onValueChange={(value) => setSaleData({ ...saleData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">Contado</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="mixto">Mixto (Pie + Crédito)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Input
                id="notes"
                value={saleData.notes}
                onChange={(e) => setSaleData({ ...saleData, notes: e.target.value })}
                placeholder="Ej: Cliente referido, incluye accesorios..."
              />
            </div>

            {/* Resumen */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">Resumen de Venta</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Precio Venta:</span>
                  <p className="font-bold">{formatCLP(saleData.salePrice)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Margen:</span>
                  <p className="font-bold text-green-600">
                    {formatCLP(saleData.salePrice - Number(vehicleToSell?.cost || 0))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Comisión (15%):</span>
                  <p className="font-bold text-blue-600">
                    {formatCLP((saleData.salePrice - Number(vehicleToSell?.cost || 0)) * 0.15)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setVehicleToSell(null);
                setSaleData({
                  salePrice: 0,
                  downPayment: 0,
                  paymentMethod: 'contado',
                  notes: ''
                });
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSellVehicle}
              disabled={isSaving || saleData.salePrice <= 0}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              {isSaving ? "Registrando..." : "Registrar Venta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
