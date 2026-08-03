import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { apiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getFullPlaylistPipeline = (matchStage) => [
  { $match: matchStage },
  {
    $lookup: {
      from: "users",
      localField: "owner",
      foreignField: "_id",
      as: "ownerDetails",
    },
  },
  { $unwind: "$ownerDetails" },
  {
    $lookup: {
      from: "videos",
      localField: "videos",
      foreignField: "_id",
      as: "videos",
      pipeline: [
        { $match: { isPublished: true } },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "videoOwner",
          },
        },
        { $unwind: { path: "$videoOwner", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            title: 1,
            thumbnail: 1,
            duration: 1,
            views: 1,
            "videoOwner.username": 1,
            "videoOwner.avatar": 1,
            "videoOwner.fullName": 1,
          },
        },
      ],
    },
  },
  {
    $project: {
      name: 1,
      description: 1,
      videos: 1,
      createdAt: 1,
      totalVideos: { $size: "$videos" },
      ownerDetails: {
        username: 1,
        avatar: 1,
        fullName: 1,
      },
    },
  },
];

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    throw new apiError(400, "Name and description is required");
  }
  const user = req.user._id;
  const playlist = await Playlist.create({
    videos: [],
    owner: user,
    description,
    name,
  });
  if (!playlist) {
    throw new apiError(500, "Something went wrong while creating playlist");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new apiError(400, "User id is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
      },
    },
    {
      $unwind: "$ownerDetails",
    },

    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $match: { isPublished: true },
          },

          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "videoOwner",
            },
          },
          {
            $unwind: {
              path: "$videoOwner",
              preserveNullAndEmptyArrays: true,
            },
          },

          {
            $project: {
              title: 1,
              thumbnail: 1,
              duration: 1,
              views: 1,
              createdAt: 1,
              "videoOwner.username": 1,
              "videoOwner.avatar": 1,
              "videoOwner.fullName": 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        videos: 1,
        createdAt: 1,
        totalVideos: { $size: "$videos" }, // count videos in playlist
        ownerDetails: {
          username: 1,
          avatar: 1,
          fullName: 1,
        },
      },
    },

    {
      $sort: { createdAt: -1 },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        playlists,
        totalPlaylists: playlists.length,
      },
      "User playlists fetched successfully"
    )
  );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new apiError(400, "Playlist id is required");
  }

  const playlist = await Playlist.aggregate(
    getFullPlaylistPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );
  if (!playlist?.length) {
    throw new apiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !videoId) {
    throw new apiError(400, "Playlist id and video id are required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new apiError(
      403,
      "You are not allowed to add video to this playlist"
    );
  }

  if (playlist.videos.includes(videoId)) {
    throw new apiError(400, "Video already exists in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $push: { videos: videoId } },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new apiError(
      500,
      "Something went wrong while adding video to playlist"
    );
  }

  const fullPlaylist = await Playlist.aggregate(
    getFullPlaylistPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, fullPlaylist, "Video added to playlist successfully")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!playlistId || !videoId) {
    throw new apiError(400, "Playlist id and video id are required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new apiError(
      403,
      "You are not allowed to remove video from this playlist"
    );
  }

  if (!playlist.videos.includes(videoId)) {
    throw new apiError(400, "Video does not exist in playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $pull: { videos: videoId } },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new apiError(
      500,
      "Something went wrong while removing video from playlist"
    );
  }

  const fullPlaylist = await Playlist.aggregate(
    getFullPlaylistPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        fullPlaylist[0],
        "Video removed from playlist successfully"
      )
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new apiError(400, "Playlist id is required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You are not allowed to delete this playlist");
  }

  await playlist.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!playlistId) {
    throw new apiError(400, "Playlist id is required");
  }

  if (!name && !description) {
    throw new apiError(400, "Name or description is required");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You are not allowed to update this playlist");
  }

  const updateFields = {};
  if (name) updateFields.name = name;
  if (description) updateFields.description = description;

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $set: updateFields },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new apiError(500, "Something went wrong while updating playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});
export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
