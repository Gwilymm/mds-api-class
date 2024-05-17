const users = require('../models/user');

exports.getUsers = (req, res) => {
	console.log('Envoi des utilisateurs:', users); // Log des utilisateurs
	res.json(users); // Assurez-vous que 'users' est toujours un tableau.
};

exports.addUser = (req, res) => {
	const { id, name, position } = req.body;
	const user = users.find(u => u.id === id);
	if (!user) {
		users.push({ id, name, position });
		res.status(201).json({ message: 'User added', user: { id, name, position } });
	} else {
		res.status(409).json({ message: 'User already exists' });
	}
};

exports.updateUserPosition = (req, res) => {
	const { id, position } = req.body;
	const user = users.find(u => u.id === id);
	if (user) {
		user.position = position;
		res.json({ message: 'Position updated', user });
	} else {
		res.status(404).json({ message: 'User not found' });
	}
};
