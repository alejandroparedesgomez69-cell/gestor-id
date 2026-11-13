# Gestor I+D

Aplicación web para gestionar proyectos de I+D: proyectos, actividades, Gantt, calendario, bitácora, prioridades y TRL.
Página estática (HTML + JS, sin dependencias).

**Los datos no están en este repositorio.** Cada usuario conecta la app a su propio repositorio *privado* de GitHub
(en *GitHub y ajustes*) con un token fine-grained limitado a ese repositorio y permiso `Contents: Read and write`.
El token se guarda solo en el navegador de quien lo usa.

Uso local sin token: `python servidor.py --repo usuario/repositorio-datos` (usa la sesión de GitHub CLI).
