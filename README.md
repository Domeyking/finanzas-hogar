# Finanzas del hogar

App web para registro y seguimiento de gastos compartidos en pareja.
Stack: React + Vite + Tailwind + Supabase + Recharts. Despliegue en Vercel. Costo: $0.

---

## Paso 1 — Crear proyecto en Supabase (5 min)

1. Ve a https://supabase.com y crea una cuenta gratis
2. Clic en "New project" → ponle nombre (ej: `finanzas-hogar`) → elige región → crea
3. Espera ~1 min a que el proyecto arranque
4. Ve a **SQL Editor** (ícono de base de datos en el menú izquierdo)
5. Clic en "New query"
6. Pega todo el contenido del archivo `supabase_schema.sql` y clic en **Run**
7. Deberías ver "Success. No rows returned"

## Paso 2 — Obtener las claves de Supabase

1. En tu proyecto de Supabase, ve a **Settings → API**
2. Copia:
   - **Project URL** → es tu `VITE_SUPABASE_URL`
   - **anon / public key** → es tu `VITE_SUPABASE_ANON_KEY`

## Paso 3 — Subir el código a GitHub

1. Crea una cuenta en https://github.com si no tienes
2. Crea un repositorio nuevo (ej: `finanzas-hogar`), público o privado
3. Sube todos los archivos de esta carpeta al repositorio
   - Si tienes Git instalado:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin https://github.com/TU_USUARIO/finanzas-hogar.git
     git push -u origin main
     ```
   - Si no, usa el botón "uploading an existing file" en GitHub.com

## Paso 4 — Desplegar en Vercel (3 min)

1. Ve a https://vercel.com y crea cuenta (puedes usar tu cuenta de GitHub)
2. Clic en "Add New → Project"
3. Importa el repositorio que creaste
4. En la sección **Environment Variables**, agrega:
   - `VITE_SUPABASE_URL` → tu Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → tu anon key de Supabase
5. Clic en **Deploy**
6. En ~1 min tendrás una URL tipo `https://finanzas-hogar-xxx.vercel.app`

## Paso 5 — Configurar autenticación en Supabase

1. En Supabase, ve a **Authentication → URL Configuration**
2. En "Site URL" pon la URL de tu app en Vercel
3. En "Redirect URLs" agrega la misma URL
4. Guarda

## Paso 6 — Crear las dos cuentas

1. Abre la app en el navegador
2. Ve a "Registrarse" → crea tu cuenta
3. Comparte la URL con tu pareja → que ella también se registre
4. ¡Listo! Ambos verán los gastos del otro en tiempo real

---

## Estructura del proyecto

```
finanzas-app/
├── supabase_schema.sql     ← SQL para crear la base de datos
├── .env.example            ← Plantilla de variables de entorno
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── src/
    ├── main.jsx            ← Entrada
    ├── App.jsx             ← Routing auth/no-auth
    ├── index.css           ← Estilos Tailwind
    ├── lib/
    │   ├── supabase.js     ← Cliente Supabase
    │   └── constants.js    ← Categorías, fuentes, colores
    ├── pages/
    │   ├── Login.jsx       ← Pantalla de login/registro
    │   └── Dashboard.jsx   ← Dashboard principal
    └── components/
        └── NuevoGasto.jsx  ← Formulario de gasto
```

## Funcionalidades

- Login y registro con email/contraseña
- Formulario rápido de gasto (fecha, descripción, monto, categoría, fuente)
- Dashboard con filtro por mes y año
- Métricas: total mes, mi parte, parte de la pareja
- Gráfico de torta por categoría
- Gráfico de barras por persona
- Lista completa de gastos del mes
- Cada usuario puede eliminar solo sus propios gastos
- Ambos ven todos los gastos en tiempo real

## Próximos pasos opcionales

- Presupuestos por categoría con alertas
- Exportar a Excel/CSV
- Notificaciones cuando se registra un gasto nuevo
- Vista de evolución mensual histórica
