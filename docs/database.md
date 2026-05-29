### Database

Prisma with SQLite (`prisma/dev.db`). Generated client outputs to `src/generated/prisma/`.

```
User  (id, email, password)
  └── Project  (id, name, userId, messages: JSON string, data: JSON string)
```

### Database Schema

The database schema is defined in the @prisma/schema.prisma file. Reference it anytime you need to understand the structure of data stored in the database.