function initLocalizador() {
    const sec = document.getElementById('seccion-localizador');
    const sel = document.getElementById('sel-origen');
    
    // Verificación básica
    if (!sec || !sel) {
        console.error("ERROR UI: Elementos HTML no encontrados.");
        return;
    }

    // Forzar visibilidad
    sec.style.display = 'block';
    
    // Limpiar dropdown
    sel.innerHTML = ''; 
    
    // Crear opción por defecto
    const optDefault = document.createElement('option');
    optDefault.value = "";
    optDefault.textContent = "-- Seleccionar Origen --";
    sel.appendChild(optDefault);

    // Verificar datos
    if (!window.registros || window.registros.length === 0) {
        const optEmpty = document.createElement('option');
        optEmpty.textContent = "Sin datos cargados";
        optEmpty.disabled = true;
        sel.appendChild(optEmpty);
        console.warn("WARNING: No hay registros.");
        return;
    }

    let count = 0;
    
    // Iterar sobre TODOS los registros
    window.registros.forEach(function(r) {
        // Extraer nombre y tipo de forma segura
        const nombreStr = String(r.nombreElemento || r.elemento || r.nombreCto || r.nombreEmpalme || "").toUpperCase();
        const tipoStr = String(r.tipoRegistro || r.elementType || "").toUpperCase();
        
        // Filtro MUY AMPLIO para asegurar que aparezcan opciones
        // Aceptamos cualquier cosa que parezca un nodo de red
        const esOrigenValido = 
            tipoStr.includes("EMP") || 
            tipoStr.includes("EQUIP") ||
            nombreStr.includes("CT") || 
            nombreStr.includes("RO") ||
            nombreStr.includes("CAJA") ||
            nombreStr.includes("ARQ") ||
            nombreStr.includes("CAMARA") ||
            nombreStr.includes("REGISTRO");

        if (esOrigenValido) {
            const opt = document.createElement('option');
            
            // Asignar ID único o fallback
            const idVal = r.idElemento || r.idEmpalme || r.id || `idx_${count}`;
            opt.value = idVal;
            
            // Texto visible
            const label = r.nombreElemento || r.elemento || r.nombreCto || "Equipo";
            opt.textContent = `${label} (${idVal})`;
            
            sel.appendChild(opt);
            count++;
        }
    });

    // Feedback final
    if (count === 0) {
        const optNone = document.createElement('option');
        optNone.textContent = "No se encontraron equipos válidos";
        optNone.disabled = true;
        sel.appendChild(optNone);
        console.error("CRITICO: El filtro no encontró nada. Revisa las propiedades de tus objetos registro.");
    } else {
        console.log(`OK: Localizador poblado con ${count} opciones.`);
    }
}