# PLaNner REST API

A REST API backend for the PLaNner web application, built with the blazingly fast **Elysia.js** framework on **Bun**.

## Prerequisites

Before you begin, make sure you have the following installed on your local machine:

- **Bun**: A fast JavaScript all-in-one toolkit
- **MySQL**: A running MySQL database instance

---

## Getting Started

Follow these steps to set up your development environment:

### 1. Install Prerequisites

You need to install **Bun** and have a **MySQL** server running.

#### Installing Bun

- **macOS / Linux**
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Windows (PowerShell)**
  ```powershell
  powershell -c "irm bun.sh/install.ps1|iex"
  ```
  _You can also install it via npm if you have Node.js installed:_
  ```bash
  npm install -g bun
  ```

#### Running MySQL

- **Windows / macOS**
  You can use a local development tool like XAMPP, Laragon, or run MySQL in a Docker container. Make sure the service is running before proceeding.

- **Linux**
  ```bash
  sudo systemctl start mysql.service
  ```

### 2. Clone the Repository

Clone the project to your local machine using HTTPS or SSH:

```bash
# Using HTTPS
git clone https://github.com/LuminousVar/backend-PLaNner.git

# Using SSH
git clone git@github.com:LuminousVar/backend-PLaNner.git

# Navigate into the project directory
cd backend-PLaNner
```

### 3. Configure and Set Up the Database

1.  **Install Dependencies**
    Install all the necessary packages using Bun.

    ```bash
    bun install
    ```

2.  **Initialize Prisma**
    If this is a fresh setup, initialize Prisma. This will create a `prisma` directory and a `.env` file for you.

    ```bash
    bunx prisma init
    ```

3.  **Configure Environment Variables**
    Open the `.env` file that was just created. Update the `DATABASE_URL` with your actual MySQL connection string.

    ```env
    # Example format
    DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
    ```

4.  **Seed and Generate Prisma Client**
    Run the following commands to populate your database with initial data and generate the Prisma client.

    ```bash
    # Seed the database with initial data
    bunx prisma db:seed

    # Generate the Prisma Client based on your schema
    bunx prisma generate
    ```

5.  **(Optional) View Database with Prisma Studio**
    You can use Prisma Studio to open a GUI in your browser for viewing and managing your database records. This is very useful for debugging.
    ```bash
    bunx prisma studio
    ```

### 4. Run the Application

Start the development server with hot-reloading.

```bash
bun run dev
```

The API is now running! You can access it at [http://localhost:5100](http://localhost:5100)

---

## API Documentation

This API includes interactive documentation via Swagger UI. Once the server is running, you can explore all available endpoints at:

- **Swagger Docs Endpoint:** [http://localhost:5100/api/swagger](http://localhost:5100/api/swagger)
