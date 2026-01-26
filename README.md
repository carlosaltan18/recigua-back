# RECIGUA Backend - Sistema de Gestión para Recicladora

Backend API desarrollado con NestJS, TypeScript y PostgreSQL para la gestión de una empresa recicladora.

## 🚀 Características

- ✅ **Autenticación JWT** con roles (Admin/User)
- ✅ **Gestión de Usuarios** con asignación de roles
- ✅ **Gestión de Proveedores** CRUD completo
- ✅ **Gestión de Productos** con precio por quintal
- ✅ **Sistema de Reportes** con cálculo automático de precios
- ✅ **Conversión automática** de unidades de peso
- ✅ **Configuración del sistema** (porcentaje adicional)
- ✅ **Paginación y búsqueda** en todas las entidades
- ✅ **Validación de datos** con class-validator
- ✅ **Docker Compose** para fácil despliegue

## 📋 Requisitos Previos

- Node.js 18+ o Docker Desktop
- PostgreSQL 16+ (si no usas Docker)
- npm o yarn

## 🛠️ Instalación

### Opción 1: Con Docker (Recomendado)

```bash
# Clonar el repositorio
git clone <tu-repositorio>
cd recigua-backend

# Crear archivo .env
cp .env.example .env

# Levantar los servicios con Docker Compose
docker-compose up -d

# La API estará disponible en http://localhost:3000/api
# PgAdmin estará disponible en http://localhost:5050
```

### Opción 2: Instalación Manual

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# Ejecutar la base de datos (si tienes PostgreSQL local)
# O usar solo el contenedor de PostgreSQL:
docker-compose up -d postgres

# Inicializar la base de datos
psql -U recigua_user -d recigua_db -f init.sql

# Iniciar el servidor en modo desarrollo
npm run start:dev

# La API estará disponible en http://localhost:3000/api
```
## Recuerda que si ya existe un volumen y quiere borralo

docker-compose down -v
docker-compose up --build


## 🗄️ Estructura del Proyecto

```
src/
├── modules/
│   ├── auth/              # Autenticación y JWT
│   │   ├── guards/        # Guards de autenticación
│   │   ├── strategies/    # Estrategias de Passport
│   │   └── decorators/    # Decoradores personalizados
│   ├── users/             # Gestión de usuarios
│   ├── roles/             # Roles del sistema
│   ├── proveedores/       # Gestión de proveedores
│   ├── productos/         # Gestión de productos
│   ├── reportes/          # Sistema de reportes
│   └── config/            # Configuración del sistema
├── app.module.ts          # Módulo principal
└── main.ts                # Entry point
```

## 🔐 Credenciales por Defecto

Después de ejecutar el `init.sql`, se crea un usuario administrador:

```
Email: admin@recigua.com
Password: admin123
```

**⚠️ IMPORTANTE: Cambiar estas credenciales en producción**

## 📡 Endpoints de la API

### Autenticación

```http
POST   /api/auth/login      # Login de usuario
GET    /api/auth/me         # Obtener perfil (requiere token)
POST   /api/auth/logout     # Logout (requiere token)
```

### Usuarios (Requiere autenticación)

```http
GET    /api/users           # Listar usuarios (paginado)
GET    /api/users/:id       # Obtener un usuario
POST   /api/users           # Crear usuario (solo admin)
PUT    /api/users/:id       # Actualizar usuario (solo admin)
DELETE /api/users/:id       # Eliminar usuario (solo admin)
```

### Roles (Requiere autenticación)

```http
GET    /api/roles           # Listar roles disponibles
```

### Proveedores (Requiere autenticación)

```http
GET    /api/proveedores           # Listar proveedores
GET    /api/proveedores/:id       # Obtener un proveedor
POST   /api/proveedores           # Crear proveedor
PUT    /api/proveedores/:id       # Actualizar proveedor
DELETE /api/proveedores/:id       # Eliminar proveedor (solo admin)
```

### Productos (Requiere autenticación)

```http
GET    /api/productos           # Listar productos
GET    /api/productos/:id       # Obtener un producto
POST   /api/productos           # Crear producto
PUT    /api/productos/:id       # Actualizar producto
DELETE /api/productos/:id       # Eliminar producto (solo admin)
```

### Reportes (Requiere autenticación)

```http
GET    /api/reportes           # Listar reportes (con filtros)
GET    /api/reportes/:id       # Obtener un reporte
POST   /api/reportes           # Crear reporte
PUT    /api/reportes/:id       # Actualizar reporte
DELETE /api/reportes/:id       # Eliminar reporte (solo admin)
```

**Query params para filtros:**
- `page`: Número de página (default: 1)
- `pageSize`: Tamaño de página (default: 10)
- `fechaInicio`: Fecha inicio (formato: YYYY-MM-DD)
- `fechaFin`: Fecha fin (formato: YYYY-MM-DD)
- `proveedorId`: UUID del proveedor
- `productoId`: UUID del producto
- `search`: Búsqueda por placa, ticket o piloto

### Configuración (Requiere autenticación)

```http
GET    /api/config             # Obtener configuración
PUT    /api/config             # Actualizar configuración (solo admin)
```

## 💡 Ejemplos de Uso

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@recigua.com",
    "password": "admin123"
  }'
```

### Crear un Reporte (con token)

```bash
curl -X POST http://localhost:3000/api/reportes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fecha": "2024-01-15",
    "placa": "P-123ABC",
    "noTicket": "TKT-001",
    "proveedorId": "uuid-del-proveedor",
    "productoId": "uuid-del-producto",
    "peso": 50,
    "unidadMedida": "quintales",
    "piloto": "Carlos López"
  }'
```

**El backend calculará automáticamente:**
- `pesoEnQuintales`: Conversión según la unidad
- `precioBase`: precio_por_quintal × peso_en_quintales
- `precioAdicional`: precio_base × (porcentaje_adicional / 100)
- `precioTotal`: precio_base + precio_adicional

## 🧮 Conversiones de Unidades

El sistema soporta las siguientes unidades de medida:

- **quintales**: Base (1 quintal = 1)
- **libras**: 1 quintal = 100 libras
- **kilogramos**: 1 quintal = 46 kg
- **toneladas**: 1 tonelada = 21.74 quintales

## 🔒 Sistema de Roles y Permisos

### Rol: Admin
- Acceso completo a todos los módulos
- Puede crear, editar y eliminar usuarios
- Puede modificar la configuración del sistema
- Puede eliminar registros

### Rol: User
- Puede ver y crear reportes
- Puede ver y gestionar proveedores y productos
- No puede eliminar registros
- No puede modificar usuarios ni configuración

## 🐳 Servicios de Docker

El `docker-compose.yml` incluye:

1. **PostgreSQL** (puerto 5432)
   - Base de datos principal
   - Se inicializa automáticamente con `init.sql`

2. **PgAdmin** (puerto 5050)
   - Interfaz web para administrar PostgreSQL
   - Usuario: `admin@recigua.com`
   - Contraseña: `admin123`

3. **Backend API** (puerto 3000)
   - API de NestJS en modo desarrollo
   - Hot reload habilitado

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Inicia en modo desarrollo con hot reload

# Producción
npm run build              # Compila el proyecto
npm run start:prod         # Inicia en modo producción

# Testing
npm run test               # Ejecuta tests unitarios
npm run test:e2e           # Ejecuta tests e2e
npm run test:cov           # Cobertura de tests

# Linting
npm run lint               # Ejecuta ESLint
npm run format             # Formatea código con Prettier
```

## 🔧 Variables de Entorno

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=recigua_user
DATABASE_PASSWORD=recigua_password
DATABASE_NAME=recigua_db

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001
```

## 🚨 Solución de Problemas

### Error de conexión a PostgreSQL

```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps

# Ver logs de PostgreSQL
docker-compose logs postgres

# Reiniciar servicios
docker-compose restart
```

### Error de permisos

```bash
# Dar permisos al directorio (Linux/Mac)
sudo chmod -R 755 .

# Reconstruir contenedores
docker-compose down
docker-compose up --build -d
```

### Puerto 3000 ya en uso

```bash
# Cambiar el puerto en .env
PORT=3001

# O matar el proceso en el puerto 3000
# Linux/Mac:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## 📚 Tecnologías Utilizadas

- **NestJS 10** - Framework de Node.js
- **TypeScript** - Lenguaje de programación
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL 16** - Base de datos
- **Passport JWT** - Autenticación
- **bcrypt** - Hash de contraseñas
- **class-validator** - Validación de DTOs
- **Docker & Docker Compose** - Containerización

## 📄 Licencia

MIT

## 👥 Soporte

Para soporte y preguntas, contacta al equipo de desarrollo.

---

**Desarrollado con ❤️ para RECIGUA**
