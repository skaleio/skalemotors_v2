import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getIsMobileDevice, getIsPhoneDevice } from "@/lib/device";

export interface DeviceContextType {
  /** true si el usuario entró desde un celular o tablet (user agent) */
  isMobileDevice: boolean;
  /** true si es teléfono (excluye tablets); útil para mostrar versión app móvil más compacta */
  isPhoneDevice: boolean;
  /** ya se ejecutó la detección en el cliente (evita flash en hidratación) */
  isReady: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

interface DeviceProviderProps {
  children: ReactNode;
}

/**
 * Provee detección de dispositivo móvil para mostrar la versión app web móvil
 * cuando el usuario inicia sesión desde un celular.
 */
export function DeviceProvider({ children }: DeviceProviderProps) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isPhoneDevice, setIsPhoneDevice] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsMobileDevice(getIsMobileDevice());
    setIsPhoneDevice(getIsPhoneDevice());
    setIsReady(true);
  }, []);

  const value: DeviceContextType = {
    isMobileDevice,
    isPhoneDevice,
    isReady,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextType {
  const ctx = useContext(DeviceContext);
  if (ctx === undefined) {
    throw new Error("useDevice debe usarse dentro de DeviceProvider");
  }
  return ctx;
}
