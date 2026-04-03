# Educator Salary Explorer

This project is a locally runnable website for exploring Minnesota educator salary data. It uses a React frontend and a Node.js/Express backend backed by MySQL.

## Project structure

```text
educator_salary_site_v2/
├── backend/
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── package.json
│   ├── public/
│   ├── src/
│   └── webpack.config.js
└── README.md
```

## Local setup

1. Install dependencies.

```bash
cd backend
npm install

cd ../frontend
npm install
```

2. Create `backend/.env` from `backend/.env.example`.

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=teacherp_v2
MYSQL_USER=teacherp_v2app
MYSQL_PASSWORD=your_real_password_here
PORT=3001
```

3. Start the backend.

```bash
cd backend
npm start
```

4. Start the frontend in a separate terminal.

```bash
cd frontend
npm start
```

5. Open [http://localhost:3000](http://localhost:3000).

## Notes

* The backend automatically loads `backend/.env` on startup.
* Shell environment variables still override `.env` values if you set them manually before starting the backend.
* If you see `Access denied for user ...`, the MySQL username, password, or grants are wrong for your local database.
