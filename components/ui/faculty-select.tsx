import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

export interface Faculty {
  id: string
  name: string
  fullName: string
}

const faculties: Faculty[] = [
  { id: "FAIN", name: "Ingeniería y Ciencias Exactas", fullName: "Facultad de Ingeniería y Ciencias Exactas" },
  { id: "FACE", name: "Ciencias Económicas", fullName: "Facultad de Ciencias Económicas" },
  { id: "FADI", name: "Arquitectura y Diseño", fullName: "Facultad de Arquitectura y Diseño" },
  { id: "FACO", name: "Comunicación", fullName: "Facultad de Comunicación" },
  { id: "FAJU", name: "Ciencias Jurídicas y Sociales", fullName: "Facultad de Ciencias Jurídicas y Sociales" },
  { id: "FASA", name: "Ciencias de la Salud", fullName: "Facultad de Ciencias de la Salud" },
]

interface FacultySelectProps {
  onSelect: (facultyId: string) => void
}

export function FacultySelect({ onSelect }: FacultySelectProps) {
  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecciona una facultad" />
      </SelectTrigger>
      <SelectContent>
        {faculties.map((faculty) => (
          <SelectItem key={faculty.id} value={faculty.id}>
            {faculty.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
} 