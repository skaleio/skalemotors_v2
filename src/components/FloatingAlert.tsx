import { useState, useEffect } from "react";
import { AlertCircle, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingAlertProps {
  show: boolean;
  onClose: () => void;
  onAction: () => void;
  title: string;
  message: string;
}

export default function FloatingAlert({ show, onClose, onAction, title, message }: FloatingAlertProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)]"
        >
          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200 dark:border-orange-800 rounded-lg shadow-lg backdrop-blur-sm overflow-hidden">
            {/* Barra superior decorativa */}
            <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />
            
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Icono */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
                    {title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {message}
                  </p>

                  {/* Botón de acción */}
                  <Button
                    onClick={onAction}
                    size="sm"
                    className="mt-3 h-8 text-xs bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
                  >
                    <Settings className="h-3 w-3 mr-1.5" />
                    Configurar ahora
                  </Button>
                </div>

                {/* Botón cerrar */}
                <button
                  onClick={handleClose}
                  className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
