# Imágenes OG (Open Graph) — previews al compartir

Estas son las imágenes que se ven cuando compartís un link del sitio en
WhatsApp, X/Twitter, Discord, etc. Cada página del sitio apunta a un archivo
de esta carpeta vía los meta tags `og:image` / `twitter:image`.

## Archivos esperados (1200×630 aprox, formato .png)

| Archivo            | Usado por        | Generado en Higgsfield (job ID)        |
|--------------------|------------------|----------------------------------------|
| `home.png`         | index.html       | 7a879e23-9d0c-4ca1-9a2b-20a64762fec2   |
| `servicios.png`    | servicios.html   | b3240273-bec8-4e18-9e57-66070ad1cdff   |
| `aether.png`       | aether.html      | 2119119e-855a-4476-ab45-3acfff6bf4fc   |
| `diario.png`       | diario.html      | f7bc582f-8a2b-4bb4-a96f-a87e1e44c078   |
| `academia.png`     | academia.html    | eb59174e-dbc6-4c2a-8e5d-a863afc85436   |

## Cómo agregarlas

1. Descargá cada imagen desde tu galería de Higgsfield (o el widget del chat).
2. Guardala en esta carpeta (`assets/og/`) con el nombre exacto de la tabla.
3. Commit + push. Una vez en `https://www.hg-vl.com/assets/og/<nombre>.png`,
   los previews aparecen al compartir.

## Verificar

- Facebook/WhatsApp: https://developers.facebook.com/tools/debug/
- X/Twitter: https://cards-dev.twitter.com/validator
  (pegá la URL de la página y "Scrape Again" para refrescar el caché)
