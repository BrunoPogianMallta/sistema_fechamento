"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
  allowedUserTypes: ("restaurant" | "deliverer")[]
  delivererId?: string
}

export function AuthGuard({ children, allowedUserTypes, delivererId }: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const userType = localStorage.getItem("userType") as "restaurant" | "deliverer" | null
    const userId = localStorage.getItem("userId")

    if (!userType || !allowedUserTypes.includes(userType)) {
      router.push("/")
      return
    }

    // Se é página de entregador específico, verificar se o usuário tem acesso
    if (delivererId && userType === "deliverer" && userId !== delivererId) {
      router.push("/")
      return
    }

    setIsAuthorized(true)
    setIsLoading(false)
  }, [router, allowedUserTypes, delivererId])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p>Verificando acesso...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
