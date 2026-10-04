# BiblioTech Django

Aplicación de catálogo de biblioteca con búsqueda, registro e inicio de
sesión, solicitudes de préstamo y administración de libros.

## Preparar MySQL

En MySQL Workbench, ejecuta:

```sql
CREATE DATABASE biblioteca_django
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

## Ejecutar en Windows PowerShell

Desde la carpeta `biblioteca_django`, activa el entorno virtual y carga la
contraseña de MySQL en la variable de entorno de la sesión. El prompt oculta
lo que escribes y la contraseña no se guarda en el proyecto:

```powershell
.\venv\Scripts\Activate.ps1
$secure = Read-Host "Contraseña MySQL" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:BIBLIOTECA_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

La variable solo permanece disponible en esa ventana de PowerShell. Vuelve a
cargarla al abrir otra terminal. La aplicación usa `root` por defecto; para
otro usuario, define `BIBLIOTECA_DB_USER` en la sesión antes de ejecutar Django.

Abre `http://127.0.0.1:8000/`. El panel de administración está en
`http://127.0.0.1:8000/admin/`; el registro público está en
`http://127.0.0.1:8000/registro/`.

Para correr las pruebas automáticas, no necesitas una conexión a MySQL:

```powershell
python manage.py test --settings=config.test_settings
```

## Seguridad

No guardes contraseñas ni tokens en el código ni en GitHub. La clave de Django
de desarrollo es local; define `DJANGO_SECRET_KEY` en el entorno si vas a
desplegar el sitio y cambia `DEBUG` a `False` antes de producción.
