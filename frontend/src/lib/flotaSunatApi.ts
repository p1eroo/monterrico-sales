export interface SunatHistorialItem {
  fecha: string;
  cantidad: number;
}

export async function getSunatHistorial(fecini: string, fecfin: string): Promise<any[]> {
  const url = `https://api.taximonterrico.com/api/wservicios/Historial?idempresas=0&idestado=1&fecini=${fecini}&fecfin=${fecfin}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error fetching SUNAT historial: ${res.statusText}`);
  }
  const data = await res.json();
  
  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data.AHistorial && Array.isArray(data.AHistorial)) {
    list = data.AHistorial;
  } else if (data.data && Array.isArray(data.data)) {
    list = data.data;
  }

  return list;
}
