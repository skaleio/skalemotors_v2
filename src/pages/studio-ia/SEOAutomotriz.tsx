import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SEOAutomotriz() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/app/studio-ia')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEO Automotriz</h1>
          <p className="text-muted-foreground">
            Optimiza tu presencia online y mejora tu posicionamiento en Google
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-lg border shadow-sm">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">SEO Automotriz</h2>
          <p className="text-gray-600 mb-6">
            Herramienta para optimizar tu presencia online y mejorar tu posicionamiento en Google
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Análisis de Palabras Clave</h3>
              <p className="text-sm text-gray-600">Encuentra las mejores palabras clave para tu automotora</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Análisis de Competidores</h3>
              <p className="text-sm text-gray-600">Analiza a tu competencia y encuentra oportunidades</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Recomendaciones SEO</h3>
              <p className="text-sm text-gray-600">Obtén recomendaciones personalizadas para mejorar tu SEO</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}