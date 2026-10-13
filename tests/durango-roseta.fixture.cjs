// Fixture: elementos REALES del circuito Durango-Roseta (KML DNG 1783630),
// con la forma que devuelve analizarKML (solo campos que usa el localizador).
// distancia = distanciaAcumulada (ground truth medido en el KML).
const P = (lon, lat) => ({ lon, lat });

module.exports = [
  { id: "1783630", orden: "1", distancia: "0", longitud: "NA", esLinea: false, nombreElemento: "RO 01", name: "ELFO:REP_F:776572", estructuraInicio: "CT DURANGO (ID 2689187)", lat: "43.16998810000001", lon: "-2.6328545", vertices: [P("-2.6328545", "43.16998810000001")] },
  { id: "11481161", orden: "3", distancia: "421.3", longitud: "421,3", esLinea: true, nombreElemento: "24 FO CAN, E2 AMO.-DNG.", estructuraInicio: "CT DURANGO (ID 2689187)", estructuraFinal: "CR GEN 10", lat: "-2.6364259", lon: "43.1722995", vertices: [P("-2.6328545", "43.16998810000001"), P("-2.6364259", "43.17229950000001")] },
  { id: "12712789", orden: "4", distancia: "1585.8", longitud: "1164,5", esLinea: true, nombreElemento: "24 FO CAN, E2 AMO.-DNG.", estructuraInicio: "CR GEN 10", estructuraFinal: "CR gABP 21", lat: "-2.6473871", lon: "43.1781343", vertices: [P("-2.6364259", "43.17229950000001"), P("-2.6473871", "43.17813430000001")] },
  { id: "15266709", orden: "5", distancia: "1585.8", longitud: "NA", esLinea: false, nombreElemento: "N\u00ba 7579 C-E 64 FO", lat: "-2.6473871", lon: "43.1781343", vertices: [P("-2.6473871", "43.17813430000001")] },
  { id: "8112857", orden: "6", distancia: "1737.8", longitud: "152", esLinea: true, nombreElemento: "8 FO CAN, C VIDEO FORTA EITB", lat: "-2.6482548", lon: "43.1790399", vertices: [P("-2.6473871", "43.17813430000001"), P("-2.6482547999999997", "43.17903989999999")] },
  { id: "13859448", orden: "7", distancia: "1737.8", longitud: "NA", esLinea: false, nombreElemento: "N\u00ba 5423 C-E 32 FO", lat: "-2.6482548", lon: "43.1790399", vertices: [P("-2.6482547999999997", "43.17903989999999")] },
  { id: "9711128", orden: "8", distancia: "2089.8", longitud: "352", esLinea: true, nombreElemento: "8 FO CAN, GAURSA AUTOAK", lat: "-2.6527944", lon: "43.1806531", vertices: [P("-2.6482547999999997", "43.17903989999999"), P("-2.6527944", "43.1806531")] },
  { id: "26138976", orden: "9", distancia: "2549.2", longitud: "459,4", esLinea: true, nombreElemento: "8 FO AER, GAURSA AUTOAK", lat: "-2.6580565", lon: "43.1821489", vertices: [P("-2.6527944", "43.1806531"), P("-2.6580565", "43.182148900000016")] },
  { id: "26617000", orden: "10", distancia: "2549.2", longitud: "NA", esLinea: false, nombreElemento: "N\u00ba 20737 C-E MINICAU", lat: "-2.6580565", lon: "43.1821489", vertices: [P("-2.6580565", "43.182148900000016")] },
  { id: "26139082", orden: "11", distancia: "2559.2", longitud: "10", esLinea: true, nombreElemento: "8 FO ACO AER, GAURSA AUTOAK", lat: "-2.6580773", lon: "43.1821551", vertices: [P("-2.6580565", "43.182148900000016"), P("-2.6580773", "43.18215509999996")] },
  { id: "26138980", orden: "12", distancia: "2654.2", longitud: "95", esLinea: true, nombreElemento: "8 FO ACO CAN, GAURSA AUTOAK", estructuraInicio: "ARQ H 418 (ID 20636482)", estructuraFinal: "ARQ H 419 (ID 20636483)", lat: "-2.6586938", lon: "43.1823394", vertices: [P("-2.6580773", "43.18215509999996"), P("-2.6586938", "43.18233939999999")] },
  { id: "26617002", orden: "13", distancia: "2654.2", longitud: "NA", esLinea: false, nombreElemento: "N\u00ba 20739 C-E 16 FO 1BD", lat: "-2.6586938", lon: "43.1823394", vertices: [P("-2.6586938", "43.18233939999999")] },
  { id: "28301117", orden: "14", distancia: "2690.8", longitud: "36,6", esLinea: true, nombreElemento: "8 FO AER, GAURSA AUTOAK", lat: "-2.6591023", lon: "43.1824727", vertices: [P("-2.6586938", "43.18233939999999"), P("-2.6591023", "43.182472700000005")] },
  { id: "28116940", orden: "15", distancia: "2690.8", longitud: "NA", esLinea: false, nombreElemento: "N\u00ba 22534 C-E 16 FO 1BD", lat: "-2.6591023", lon: "43.1824727", vertices: [P("-2.6591023", "43.182472700000005")] },
  { id: "28301118", orden: "16", distancia: "2740.9", longitud: "50,1", esLinea: true, nombreElemento: "8 FO AER, GAURSA AUTOAK", lat: "-2.6592456", lon: "43.1828274", vertices: [P("-2.6591023", "43.182472700000005"), P("-2.6592456", "43.18282740000001")] },
  { id: "15126005", orden: "17", distancia: "2740.9", longitud: "NA", esLinea: false, nombreElemento: "PTRO 63 ROSETA", lat: "-2.6592456", lon: "43.1828274", vertices: [P("-2.6592456", "43.18282740000001")] }
];
