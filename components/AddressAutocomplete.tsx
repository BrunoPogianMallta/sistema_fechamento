"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"

interface AddressAutocompleteProps {
  onSelect: (address: string, neighborhood: string) => void
  disabled?: boolean
  availableNeighborhoods?: string[]
  initialValue?: string
  className?: string
  placeholder?: string
}

export function AddressAutocomplete({
  onSelect,
  disabled = false,
  availableNeighborhoods = [],
  initialValue = "",
  className = "",
  placeholder = "Digite um endereço em Curitiba"
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(initialValue)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [isValid, setIsValid] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const timerRef = useRef<NodeJS.Timeout>()
  const predictionsCache = useRef<Record<string, google.maps.places.AutocompletePrediction[]>>({})

  // Configuração do debounce (500ms)
  const DEBOUNCE_DELAY = 500
  const MIN_CHARS_FOR_SEARCH = 4

  // Normaliza strings para comparação
  const normalize = useCallback((str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  }, [])

  // Carrega a API do Google Maps
  useEffect(() => {
    if (typeof window === "undefined") return

    const initAutocompleteService = () => {
      if (window.google?.maps?.places) {
        autocompleteService.current = new google.maps.places.AutocompleteService()
        const map = new google.maps.Map(document.createElement('div'))
        placesService.current = new google.maps.places.PlacesService(map)
        setIsScriptLoaded(true)
        return true
      }
      return false
    }

    if (!initAutocompleteService()) {
      const existingScript = document.querySelector(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      )
      
      if (!existingScript) {
        const script = document.createElement("script")
        script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDYKWQR4HgR11Oi0g8VcpsvgEcR4VsV4QQ&libraries=places&language=pt-BR"
        script.async = true
        script.onload = initAutocompleteService
        document.head.appendChild(script)
      } else {
        existingScript.addEventListener("load", initAutocompleteService)
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filtra sugestões por bairros permitidos
  const filterByNeighborhood = useCallback((predictions: google.maps.places.AutocompletePrediction[]) => {
    if (availableNeighborhoods.length === 0) return predictions

    return predictions.filter(prediction => {
      const description = normalize(prediction.description)
      return availableNeighborhoods.some(neighborhood => 
        description.includes(normalize(neighborhood))
    })
  }, [availableNeighborhoods, normalize])

  // Busca sugestões com debounce e cache
  const fetchSuggestions = useCallback(async (input: string) => {
    if (!autocompleteService.current || input.length < MIN_CHARS_FOR_SEARCH) {
      setSuggestions([])
      return
    }

    // Verifica cache primeiro
    if (predictionsCache.current[input]) {
      setSuggestions(filterByNeighborhood(predictionsCache.current[input]))
      setShowDropdown(true)
      return
    }

    setIsLoading(true)
    
    try {
      const request = {
        input,
        componentRestrictions: { country: 'br' },
        types: ['address'],
        location: new google.maps.LatLng(-25.4297, -49.2717), // Centro de Curitiba
        radius: 20000, // 20km
      }

      autocompleteService.current.getPlacePredictions(
        request,
        (predictions, status) => {
          if (status === 'OK' && predictions) {
            // Armazena no cache
            predictionsCache.current[input] = predictions
            
            // Filtra por bairros permitidos
            const filtered = filterByNeighborhood(predictions)
            setSuggestions(filtered)
            setShowDropdown(filtered.length > 0)
          } else {
            setSuggestions([])
          }
          setIsLoading(false)
        }
      )
    } catch (error) {
      console.error("Error fetching suggestions:", error)
      setIsLoading(false)
    }
  }, [filterByNeighborhood])

  // Handler para mudanças no input
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowDropdown(false)
    setIsValid(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    
    if (value.length >= MIN_CHARS_FOR_SEARCH) {
      timerRef.current = setTimeout(() => fetchSuggestions(value), DEBOUNCE_DELAY)
    } else {
      setSuggestions([])
    }
  }, [fetchSuggestions])

  // Seleciona um endereço
  const handleSelect = useCallback(async (placeId: string, description: string) => {
    if (!placesService.current) return

    try {
      setIsLoading(true)
      placesService.current.getDetails(
        { placeId, fields: ['address_components', 'formatted_address'] },
        (place, status) => {
          if (status === 'OK' && place) {
            const address = place.formatted_address || description
            const neighborhood = place.address_components?.find(
              c => c.types.includes('sublocality') || c.types.includes('neighborhood')
            )?.long_name || ''

            // Verifica se o bairro está na lista permitida
            if (availableNeighborhoods.length > 0) {
              const normalizedNeighborhood = normalize(neighborhood)
              const isValidNeighborhood = availableNeighborhoods.some(
                n => normalize(n) === normalizedNeighborhood
              )
              
              if (!isValidNeighborhood) {
                setIsValid(false)
                setIsLoading(false)
                return
              }
            }

            setInputValue(address)
            setShowDropdown(false)
            setIsValid(true)
            onSelect(address, neighborhood)
          }
          setIsLoading(false)
        }
      )
    } catch (error) {
      console.error("Error selecting address:", error)
      setIsLoading(false)
    }
  }, [availableNeighborhoods, normalize, onSelect])

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length >= MIN_CHARS_FOR_SEARCH && setShowDropdown(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${
            isValid ? 'border-gray-300 focus:ring-blue-500' : 'border-red-500 focus:ring-red-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {!isValid && (
        <p className="mt-1 text-sm text-red-600">
          {availableNeighborhoods.length > 0
            ? "Por favor, selecione um endereço válido nos bairros permitidos"
            : "Por favor, selecione um endereço válido em Curitiba"}
        </p>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto"
        >
          {suggestions.map((prediction) => (
            <div
              key={prediction.place_id}
              className="p-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
              onClick={() => handleSelect(prediction.place_id, prediction.description)}
            >
              <div className="font-medium">{prediction.description}</div>
              <div className="text-xs text-gray-500 mt-1">
                {prediction.description.includes('Curitiba') ? '' : 'Curitiba, PR'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}