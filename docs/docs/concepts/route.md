# Routes

Nevr automatically generates a standard set of RESTful routes for each entity.

## Standard Routes

For an entity named `user`:

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/users` | List all users (supports pagination/filtering) |
| `GET` | `/users/:id` | Get a single user by ID |
| `POST` | `/users` | Create a new user |
| `PUT` | `/users/:id` | Update a user (full update) |
| `PATCH` | `/users/:id` | Update a user (partial update) |
| `DELETE` | `/users/:id` | Delete a user |

## Custom Routes

You can add custom routes to an entity using the `.route()` method (conceptually).

*Note: Custom route definition API is currently being refined.*
