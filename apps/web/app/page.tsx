import { supabase } from "../lib/supabase";

   export default async function Home() {
     const { data: personas } = await supabase
       .from("person_record")
       .select("full_name, age, last_seen_zone, status");

     return (
       <main style={{ padding: 24, fontFamily: "system-ui" }}>
         <h1>Reconecta VE — prueba de base de datos</h1>
         <ul>
           {personas?.map((p, i) => (
             <li key={i}>
               {p.full_name} · {p.age} años · {p.last_seen_zone} · {p.status}
             </li>
           ))}
         </ul>
       </main>
     );
   }