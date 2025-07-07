"use client"

import React, { useEffect, useState, useRef } from "react"

interface AddressAutocompleteProps {
  onSelect: (address: string, neighborhood: string) => void
  disabled?: boolean
  availableNeighborhoods?: string[]
}

export function AddressAutocomplete({
  onSelect,
  disabled = false,
  availableNeighborhoods = [],
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState("")
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const normalize = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()

  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.google?.maps?.places) {
      setIsScriptLoaded(true)
      return
    }

    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    )
    if (existingScript) {
      existingScript.addEventListener("load", () => setIsScriptLoaded(true))
      return
    }

    const script = document.createElement("script")
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=AIzaSyDYKWQR4HgR11Oi0g8VcpsvgEcR4VsV4QQ&libraries=places&language=pt-BR"
    script.async = true
    script.onload = () => setIsScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (
      !isScriptLoaded ||
      !inputRef.current ||
      typeof window.google === "undefined" ||
      typeof window.google.maps === "undefined" ||
      typeof window.google.maps.places === "undefined"
    ) {
      return
    }

    const options: google.maps.places.AutocompleteOptions = {
      types: ["address"],
      componentRestrictions: { country: "br" },
      fields: ["address_components", "formatted_address"],
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, options)
    autocompleteRef.current = autocomplete

    const handlePlaceChanged = () => {
      const place = autocomplete.getPlace()
      if (!place || !place.address_components || !place.formatted_address) return

      const neighborhoodComponent = place.address_components.find(
        (comp: google.maps.GeocoderAddressComponent) =>
          comp.types.includes("sublocality_level_1") || comp.types.includes("neighborhood")
      )

      const rawNeighborhood = neighborhoodComponent?.long_name || ""
      const normalizedNeighborhood = normalize(rawNeighborhood)

      const matchedNeighborhood =
        availableNeighborhoods.find((b) => normalize(b) === normalizedNeighborhood) || rawNeighborhood

      setInputValue(place.formatted_address)
      onSelect(place.formatted_address, matchedNeighborhood)
    }

    autocomplete.addListener("place_changed", handlePlaceChanged)

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [isScriptLoaded, availableNeighborhoods, onSelect])

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder="Digite o endereço completo"
      disabled={disabled}
      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}
