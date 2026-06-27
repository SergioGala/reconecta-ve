"use client";
   import { useEffect, useState } from "react";

   export default function EstadoConexion() {
     const [online, setOnline] = useState(true);

     useEffect(() => {
       setOnline(navigator.onLine);
       const subir = () => setOnline(true);
       const bajar = () => setOnline(false);
       window.addEventListener("online", subir);
       window.addEventListener("offline", bajar);
       return () => {
         window.removeEventListener("online", subir);
         window.removeEventListener("offline", bajar);
       };
     }, []);

     return (
       <div style={{
         fontSize: 13, padding: "6px 12px", borderRadius: 999,
         display: "inline-flex", gap: 8, alignItems: "center",
         border: "1px solid #DCE4E4",
         color: online ? "#2E7D55" : "#B5650A",
       }}>
         <span style={{
           width: 8, height: 8, borderRadius: "50%",
           background: online ? "#2E7D55" : "#B5650A",
         }} />
         {online ? "En línea" : "Sin conexión · datos en caché"}
       </div>
     );
   }