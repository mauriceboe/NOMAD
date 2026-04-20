# Admin — Users and Invites

The **Users** tab in the Admin Panel lets you view all registered users, manage their accounts, and create invite links so new people can register without open registration.

<!-- TODO: screenshot: users table with invite form -->

![Users tab](assets/UsersAndInvites.png)

## User list

The user table shows every registered account with the following columns:

| Column | Description |
|--------|-------------|
| **User** | Avatar, username, and an always-visible presence dot (green = online, grey = offline) |
| **Email** | Account email address |
| **Role** | Badge showing `admin` or `user` |
| **Created** | Account creation date |
| **Last Login** | Date and time of most recent login |
| **Actions** | Edit and delete buttons |

Your own account row is highlighted. You cannot delete your own account.

## User actions

### Edit a user

Click the pencil icon on any row to open the edit form. You can change:

- **Username**
- **Email address**
- **Role** — toggle between `user` and `admin`
- **Password** — set a new password; must be at least 8 characters

Click **Save** to apply changes.

### Delete a user

Click the trash icon and confirm. Deletion is permanent. The user's account is removed from the database along with their data (cascade behavior is enforced at the database level).

You cannot delete your own account while logged in as that user.

## Creating a user directly

Click **Create User** (top-right of the Users tab) to create an account without an invite link. You set the username, email, password, and role at creation time.

## Invite links

Invite links let a specific number of people register themselves. This is useful when open registration is disabled.

![Invite links](assets/InviteLinkForm.png)

### Creating an invite

Click **Create Invite** (invite links section, below the user table). Configure:

- **Max uses** — how many times the link can be used before it expires: `1×`, `2×`, `3×`, `4×`, `5×`, or `∞` (unlimited). Defaults to `1×`.
- **Expiry** — how long the link remains valid: `1d`, `3d`, `7d`, `14d`, or `∞` (no expiry). Defaults to `7d`.

After creation the link is copied to your clipboard automatically. Share it with the intended recipient. The URL format is:

```
<APP_URL>/register?invite=<token>
```

### Invite list

Existing invites are listed below the creation button. Each row shows:

- The invite token (truncated, monospace)
- A status badge — `active`, `used up`, or `expired`
- **Usage** — `used / max` (or `used / ∞` for unlimited)
- **Expiry** date, if set
- **Created by** — the admin who generated the link
- A **copy link** button (only shown for active invites)
- A **delete** (revoke) button

Revoking an invite immediately invalidates it; anyone following the link after revocation will receive an error.

## Permissions

The **Users** tab also hosts the Permissions panel at the bottom, which controls what roles can perform which actions. See [Admin-Permissions](Admin-Permissions) for details.

## Related pages

- [Login-and-Registration](Login-and-Registration)
- [Invite-Links](Invite-Links)
- [Admin-Permissions](Admin-Permissions)
- [Two-Factor-Authentication](Two-Factor-Authentication)
- [Admin-Panel-Overview](Admin-Panel-Overview)
