/* ================= TABLA ================= */

function initLocalizador() {
    const sec = document.getElementById('seccion-localizador');
    const sel = document.getElementById('sel-origen');
    
    // 1. Verificación Básica
    if (!sec || !sel) {
        console.error("❌ ERROR UI: No se encuentran #seccion-localizador o #sel-origen");
        return;
    }

    // 2. Forzar Visibilidad (por si acaso CSS lo oculta)
    sec.style.display = 'block';
    
    // 3. Limpiar y Preparar Dropdown
    sel.innerHTML = '<option value="">-- Cargando... --</option>';
    sel.disabled = true; // Bloquear hasta tener datos

    // 4. Verificar Datos Globales
    if (!window.registros || window.registros.length === 0) {
        console.warn("⚠️ WARNING: window.registros está vacío.");
        sel.innerHTML = '<option value="">Sin datos (Carga KML)</option>';
        return;
    }

    let count = 0;
    const optionsFragment = document.createDocumentFragment();

    // Añadimos opción vacía primero
    const defaultOpt = document.createElement('option');
    defaultOpt.value = "";
    defaultOpt.text = "-- Seleccionar Origen --";
    optionsFragment.appendChild(defaultOpt);

    // 5. Iterar sobre TODOS los registros para encontrar orígenes válidos
    // Usamos criterios muy laxos para asegurar que algo aparezca
    window.registros.forEach(function(r) {
        // Identificadores posibles de equipo/caja/origen
        const nombre = String(r.nombreElemento || r.elemento || r.nombreCto || r.nombreEmpalme || "").toUpperCase();
        const tipo = String(r.tipoRegistro || r.elementType || "").toUpperCase();
        
        // Filtro Ampliado: Cualquier cosa que parezca un nodo de red (EMP, EQUIPMENT, CT, RO, CAJA, ARQ)
        const esPosibleOrigen = 
            tipo.includes("EMP") || 
            tipo.includes("EQUIP") ||
            nombre.includes("CT") || 
            nombre.includes("RO") ||
            nombre.includes("CAJA") ||
            nombre.includes("ARQ") ||
            nombre.includes("CAMARA");

        if (esPosibleOrigen) {
            const opt = document.createElement('option');
            // ID único obligatorio para localizer.js
            opt.value = r.idElemento || r.idEmpalme || r.id || `auto_${count}`;
            
            // Texto legible
            const etiqueta = r.nombreElemento || r.elemento || r.nombreCto || "Equipo Sin Nombre";
            opt.text = `${etiqueta} (${opt.value})`;
            
            optionsFragment.appendChild(opt);
            count++;
        }
    });

    // 6. Insertar todas las opciones de golpe (más rápido y seguro)
    sel.appendChild(optionsFragment);
    sel.disabled = false; // Habilitar selección

    // Feedback Visual
    if (count === 0) {
        sel.innerHTML = '<option value="">⚠️ No se hallaron equipos (Revisa KML)</option>';
        console.error("💥 CRÍTICO: El filtro no encontró ningún registro como origen.");
    } else {
        console.log(`✅ Localizador listo: ${count} orígenes disponibles.`);
    }
}