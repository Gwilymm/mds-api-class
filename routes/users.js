/* This code snippet is defining a router in a Node.js Express application for handling user-related
routes. Here's a breakdown of what each part does: */
// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);
router.post('/', userController.addUser);
router.put('/', userController.updateUserPosition);

module.exports = router;
