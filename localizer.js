/**
 * MOTOR DE LOCALIZACIÓN BIDIRECCIONAL CON CALIBRACIÓN DE CAMPO
 * Reglas: CR(Camaras)=+35m, Arqueta=+15m, Transicion=+35m, Curva Base=1.05x
 */
async function calcularPosicionDeCorte(registros, metrosObjetivo, origenId) {
    if (!registros || registros.length === 0) throw new Error("No hay datos cargados.");

    // 1. CONSTRUIR LA RUTA COMPLETA ORDENADA TOPOLOGICAMENTE
    // Asumimos que 'registros' ya tiene un campo 'orden' o podemos derivarlo.
    // Si no, ordenamos por ID numérico como fallback común en KMLs exportados.
    let ruta = [...registros].sort((a, b) => {
        const ordA = parseInt(a.orden || a.idElemento || 0);
        const ordB = parseInt(b.orden || b.idElemento || 0);
        return ordA - ordB;
    });

    // 2. DETECCIÓN BIDIRECCIONAL AUTOMÁTICA
    // Verificamos si el 'origenId' corresponde al primer elemento o al último de la ruta secuencial.
    const primerElem = ruta[0];
    const ultimoElem = ruta[ruta.length - 1];
    
    const esInicio = (primerElem.idElemento === origenId || primerElem.elemento === origenId);
    const esFin = (ultimoElem.idElemento === origenId || ultimoElem.elemento === origenId);

    if (!esInicio && !esFin) {
        // Si no es ni inicio ni fin exacto, buscamos coincidencia parcial o asumimos inicio
        console.warn(`Origen ${origenId} no coincide claramente con extremos. Asumiendo dirección normal.`);
    } else if (esFin) {
        // ¡CASO CRÍTICO! El usuario mide desde el final hacia atrás.
        // Invertimos la ruta para simular que empezamos en ese punto.
        ruta.reverse();
        console.log("🔄 Dirección INVERTIDA detectada. Ruta recalculada desde el extremo opuesto.");
    }

    // 3. ALGORITMO DE ACUMULACIÓN CON FACTORES EMPÍRICOS
    let distAcumuladaReal = 0;
    let pasoAnteriorTipo = null;

    for (let i = 0; i < ruta.length; i++) {
        const paso = ruta[i];
        let longitudBase = 0;
        
        const nombre = String(paso.nombreElemento || paso.elemento || "").toUpperCase();
        const tipoActual = paso.tipoRegistro || paso.elementType || "";

        // --- A. LÓGICA PARA TRAMOS (TRANSMEDIA/CABLE) ---
        if (tipoActual.includes("TRAMO") || tipoActual.includes("LINE") || paso.esTramo) {
            // Longitud vectorial pura del KML
            longitudBase = parseFloat(paso.longitudVectorial || paso.distancia || 0);
            
            // Factor de Tortuosidad Base (curvas suaves en calle/carretera)
            const FACTOR_CURVA_BASE = 1.05; 
            longitudBase *= FACTOR_CURVA_BASE;

            // Detección de Transición Canalización <-> Aéreo (+35m)
            // Comparamos el tipo de este tramo con el anterior
            if (pasoAnteriorTipo && pasoAnteriorTipo !== tipoActual) {
                 // Si cambia de CAN a AER o viceversa, sumamos holgura de maniobra
                 if ((/CAN/i.test(pasoAnteriorTipo) && /AER/i.test(tipoActual)) || 
                     (/AER/i.test(pasoAnteriorTipo) && /CAN/i.test(tipoActual))) {
                     longitudBase += 35;
                 }
            }

        } 
        // --- B. LÓGICA PARA EQUIPOS (CAJAS/ARQUETAS) ---
        else if (tipoActual.includes("EMP") || tipoActual.includes("EQUIPMENT")) {
            
            // REGLA 1: CÁMARAS DE REGISTRO (CR) -> +35 MTS
            if (/CAMARA|CAM\b|^CR$|CAJA REGISTRO/.test(nombre)) {
                longitudBase += 35; 
            } 
            
            // REGLA 2: ARQUETAS -> +15 MTS
            else if (/ARQ|ARQUETA|POZO/.test(nombre)) {
                longitudBase += 15; 
            }
            
            // Si es un equipo neutro sin slack específico, longitudBase = 0 (solo pasa el contador)
        }

        // Acumular distancia física real
        distAcumuladaReal += longitudBase;

        // --- C. CHECKPOINT: ¿Hemos alcanzado el objetivo? ---
        if (distAcumuladaReal >= metrosObjetivo) {
            
            // Calcular cuánto falta dentro de ESTE paso específico
            const distPrevia = distAcumuladaReal - longitudBase;
            const fraccionRestante = metrosObjetivo - distPrevia;
            
            // Interpolación Geométrica
            if (longitudBase > 0 && (paso.latInicio !== undefined || paso.lat !== undefined)) {
                
                // Obtener coordenadas de inicio y fin del segmento actual
                // Nota: Dependiendo de cómo parseaste el KML, esto puede variar.
                // Ajustamos para soportar formatos comunes.
                
                let latStart, lonStart, latEnd, lonEnd;
                
                if (paso.latInicio && paso.lonInicio) {
                    latStart = paso.latInicio; lonStart = paso.lonInicio;
                    latEnd = paso.latFin; lonEnd = paso.lonFin;
                } else if (paso.lat && paso.lon) {
                    // Si solo tiene un punto central, estimamos pequeño offset o usamos ese punto
                    // Para precisión real, necesitamos vertices start/end. 
                    // Si falla aquí, avísame y ajustamos el parser de KML.
                    latStart = paso.lat; lonStart = paso.lon;
                    latEnd = paso.lat; lonEnd = paso.lon; 
                } else {
                    throw new Error("Faltan coordenadas geométricas para interpolar.");
                }

                const porcentajeRecorrido = fraccionRestante / longitudBase;
                
                const latFinal = latStart + ((latEnd - latStart) * porcentajeRecorrido);
                const lonFinal = lonStart + ((lonEnd - lonStart) * porcentajeRecorrido);

                return {
                    lat: latFinal,
                    lon: lonFinal,
                    tramoNombre: paso.nombreElemento || paso.id || `Tramo ${i}`,
                    cajasPrevias: obtenerListaEquipos(ruta.slice(0, i)),
                    direccionDetectada: esFin ? "REVERSA (Desde Destino)" : "NORMAL (Desde Origen)",
                    metodo: "Calibración Shimad7 v2 (Bidireccional)"
                };
            } else {
                // Caída directa en un equipo puntual
                return {
                    lat: paso.lat || 0,
                    lon: paso.lon || 0,
                    tramoNombre: `Equipo: ${paso.nombreElemento}`,
                    cajasPrevias: obtenerListaEquipos(ruta.slice(0, i)),
                    direccionDetectada: esFin ? "REVERSA" : "NORMAL",
                    metodo: "Impacto Puntual"
                };
            }
        }

        // Preparar para siguiente iteración
        pasoAnteriorTipo = tipoActual;
    }

    throw new Error(`Distancia solicitada (${metrosObjetivo}m) excede la longitud total calibrada.`);
}

// Helper simple para listar equipos anteriores
function obtenerListaEquipos(subRuta) {
    return subRuta.filter(r => r.tipoRegistro === "EMP" || r.elementType === "EQUIPMENT")
                  .map(r => r.nombreElemento || r.elemento)
                  .slice(-3); // Solo los últimos 3 relevantes
}