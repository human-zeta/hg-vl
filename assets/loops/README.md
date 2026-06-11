# Fondos loop — videos de fondo para perfiles

Videos loop que cualquier usuario puede elegir como fondo animado de su perfil,
desde la sección **FONDO → ELEGIR VIDEO LOOP** en `perfil.html`. El catálogo
vive en Firebase (`/bgloops`) y se administra desde `admin.html` → **FONDOS LOOP**.

Estos `.mp4` se sirven desde el propio repo (no desde un CDN externo) para que
los fondos no se rompan si la fuente original rota o borra los archivos.

## Archivos esperados (16:9, ~4s, mp4, generados con Higgsfield · Seedance 2.0)

| Archivo                  | Nombre en catálogo  | Estética                                  | Job ID (Higgsfield)                    |
|--------------------------|---------------------|-------------------------------------------|----------------------------------------|
| `acid-data-stream.mp4`   | Acid Data Stream    | Void negro + data streams verde ácido     | 25597865-dcbc-4bf7-9b63-f132d7cf90ee   |
| `crt-glitch.mp4`         | CRT Glitch          | Scanlines magenta/cyan, distorsión VHS    | 789f2a74-7c73-49bb-a9a3-8b6f0b90b2ee   |
| `deep-drift.mp4`         | Deep Drift          | Gradiente líquido teal/violeta, calmo     | 2f0247ba-f3fe-4866-bfed-82e9e37297e5   |
| `gold-particles.mp4`     | Gold Particles      | Partículas doradas flotando, bokeh        | 488d7bb0-1497-43d0-b10c-c378605f2063   |
| `wireframe-mesh.mp4`     | Wireframe Mesh      | Malla wireframe verde ácido morphing      | 94b1f713-7d32-4301-9ead-df56e7369e42   |
| `sound-spectrum.mp4`     | Sound Spectrum      | Waveform / espectro de audio neón         | 4f8972b3-763f-4ce6-acfa-e43684c24590   |

## Cómo agregarlos

1. Descargá cada video desde tu galería de Higgsfield (o el widget del chat).
2. Guardalo en esta carpeta (`assets/loops/`) con el nombre exacto de la tabla.
3. Commit + push (a `main`, igual que las imágenes OG).
4. Entrá a `admin.html` → **FONDOS LOOP** → botón **CARGAR LOOPS INICIALES**:
   pre-carga el catálogo apuntando a `/assets/loops/*.mp4` de una sola vez.
   (También podés agregar otros manualmente con el formulario de nombre + URL.)

## Reglas de Firebase necesarias

```json
"bgloops": {
  ".read": true,
  ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
}
```
