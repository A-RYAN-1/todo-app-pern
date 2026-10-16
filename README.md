# Todo App Using PERN Stack

This is a Todo application built using the **PERN stack**, which stands for **PostgreSQL**, **Express.js**, **React**, and **Node.js**. The application allows users to create, edit, and delete tasks in a todo list, with data stored in a PostgreSQL database and a RESTful API backend built with Node.js and Express.

## Live Working

- Frontend: React (hosted on Vercel)
- Backend: Node.js + Express (hosted on Render)
- Database: PostgreSQL (hosted on Supabase)
- Link: https://todo-vercel-frontend.vercel.app/

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Setup](#project-setup)
- [Backend API](#backend-api)
  - [Database](#database)
  - [Express API](#express-api)
- [Frontend (React)](#frontend-react)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Tech Stack

This project uses the following technologies:

- **Frontend**: React.js
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Styling**: Bootstrap for UI components and layout

## Project Setup

To set up the project locally, follow the steps below:

1. **Clone the repository**:

    ```bash
    git clone https://github.com/A-RYAN-1/todo-app-pern.git
    cd todo-app-pern
    ```

2. **Set up the backend (Node.js + Express + PostgreSQL)**:
   
    1. Navigate to the `backend` directory:
    
        ```bash
        cd backend
        ```

    2. Install dependencies:
    
        ```bash
        npm install
        ```

    3. Configure the PostgreSQL database connection. Make sure you have PostgreSQL running locally and create a database named `store`.

    4. Set up the environment variables (create a `.env` file in the `backend` folder):

        ```
        DB_USER=your_username
        DB_PASSWORD=your_password
        DB_HOST=localhost
        DB_PORT=5432
        DB_NAME=todos_db
        ```

    5. Run database migrations (using your preferred PostgreSQL migration strategy, or manually set up the tables based on the structure in `server.js`).

    6. Start the backend server:

        ```bash
        npm start
        ```

3. **Set up the frontend (React)**:

    1. Navigate to the `frontend` directory:
    
        ```bash
        cd frontend
        ```

    2. Install dependencies:
    
        ```bash
        npm install
        ```

    3. Start the frontend server:

        ```bash
        npm start
        ```

4. **Access the application**:

    - The backend will run on `http://localhost:5000`.
    - The frontend will run on `http://localhost:3000`.

## Backend API

The backend consists of a RESTful API built using **Express.js** and **Node.js**.

### Database

We use **PostgreSQL** to store the todo items. The database contains the following table:

- **todos**:
  - `todo_id`: Integer (Primary Key)
  - `description`: String (Text)

### Express API

The backend API has the following routes:

- **GET** `/todos`:
    - Fetch all todos from the database.
    - Returns a list of todo objects.

- **POST** `/todos`:
    - Create a new todo.
    - Expects a `description` field in the request body.

- **PUT** `/todos/:id`:
    - Update the description of a specific todo by ID.
    - Expects a `description` field in the request body.

- **DELETE** `/todos/:id`:
    - Delete a todo by ID.

## Frontend (React)

The frontend is built using **React** and provides an interface for the user to interact with the todo list. It has the following components:

- **InputTodo**: A form for adding new todo items to the list.
- **ListTodos**: Displays all the todos in a table format, allowing users to edit or delete them.
- **EditTodo**: Allows users to edit the description of an existing todo item.

### Key Features:

1. **Adding Todos**: The user can input a description and click the "Add" button to save it in the database.
2. **Editing Todos**: The user can edit the description of any existing todo by clicking the "Edit" button, which triggers a modal form.
3. **Deleting Todos**: The user can delete any todo from the list, which will remove it from both the UI and the database.

The frontend communicates with the backend through API calls (via **fetch**), sending HTTP requests to the server to interact with the database.

### Styling

The UI is styled using **Bootstrap**, which provides ready-to-use components for buttons, modals, and tables, making the interface responsive and user-friendly.

## Usage

1. Run the frontend and backend servers as mentioned in the Project Setup section.
2. Open your browser and go to `http://localhost:3000` to access the Todo app.
3. You can add new todos, edit existing todos, and delete todos from the list.

## Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request.

## Project Demo

https://github.com/user-attachments/assets/61315650-f34a-4dbd-98c7-b89fcf4b005d

https://github.com/user-attachments/assets/0a05ea13-14de-4119-8e71-9bcb01c1c061

https://github.com/user-attachments/assets/30fc534e-d343-44c7-98f8-acccd4de3a0a
