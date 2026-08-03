# Video Platform Backend API

A production-grade REST API for a video hosting platform built as part of my backend development journey following the Chai aur Backend series by Hitesh Choudhary.

## Features

- JWT Authentication with access and refresh tokens
- Video upload and management with Cloudinary
- Like, comment and subscription system
- Playlist management
- Tweet/community posts
- Pagination, filtering and sorting
- MongoDB aggregation pipelines
- Role-based authorization

## Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT
- bcrypt
- Cloudinary
- Multer
- dotenv

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/users/register | Register new user |
| POST | /api/users/login | Login user |
| POST | /api/users/logout | Logout user |
| POST | /api/users/refresh-token | Refresh access token |

### Videos
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/videos | Get all videos |
| POST | /api/videos | Upload video |
| GET | /api/videos/:id | Get video by id |
| PATCH | /api/videos/:id | Update video |
| DELETE | /api/videos/:id | Delete video |
| PATCH | /api/videos/toggle/:id | Toggle publish status |

### Comments
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/comments/:videoId | Get video comments |
| POST | /api/comments/:videoId | Add comment |
| PATCH | /api/comments/:id | Update comment |
| DELETE | /api/comments/:id | Delete comment |

### Likes
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/likes/video/:id | Toggle video like |
| POST | /api/likes/comment/:id | Toggle comment like |
| POST | /api/likes/tweet/:id | Toggle tweet like |
| GET | /api/likes/videos | Get liked videos |

### Playlists
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/playlists | Create playlist |
| GET | /api/playlists/:id | Get playlist |
| PATCH | /api/playlists/:id | Update playlist |
| DELETE | /api/playlists/:id | Delete playlist |
| POST | /api/playlists/:id/videos/:videoId | Add video |
| DELETE | /api/playlists/:id/videos/:videoId | Remove video |
| GET | /api/playlists/user/:userId | Get user playlists |

### Subscriptions
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/subscriptions/:channelId | Toggle subscription |
| GET | /api/subscriptions/channel/:channelId | Get subscribers |
| GET | /api/subscriptions/user/:subscriberId | Get subscribed channels |

### Tweets
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/tweets | Create tweet |
| GET | /api/tweets/user/:userId | Get user tweets |
| PATCH | /api/tweets/:id | Update tweet |
| DELETE | /api/tweets/:id | Delete tweet |

## Setup

1. Clone the repo
2. Run `npm install`
3. Create `.env` file:
4. Run `npm run dev`

## What I learned

- How JWT authentication works under the hood
- Access token vs refresh token pattern
- MongoDB aggregation pipelines for complex queries
- File uploads with Multer and Cloudinary
- Production-grade project structure
- Authorization and ownership checks
- Database optimization — minimizing DB calls
