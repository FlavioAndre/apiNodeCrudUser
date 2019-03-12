const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mailer = require('../../modules/mailer');
const authConfig = require('../../config/auth.json');

const User = require('../models/user');

const router = express.Router();

function generateToken(params = {}) {
    return jwt.sign(params, authConfig.secret, {
        expiresIn: 24 * 60 * 60
    });
}

router.post('/register', async (req, res) => {
    const {
        email
    } = req.body;

    try {
        if (
            await User.findOne({
                email
            })
        ) {
            return res.status(400).send({
                error: 'User already existis'
            });
        }

        const user = await User.create(req.body);
        user.password = undefined;

        return res.send({
            user,
            token: generateToken({
                id: user.id
            })
        });
    } catch (error) {
        return res.status(400).send({
            error: 'Registration failed'
        });
    }
});

router.post('/authenticate', async (req, res) => {
    const {
        email,
        password
    } = req.body;

    const user = await User.findOne({
        email
    }).select('+password');

    if (!user) {
        return res.status(400).send({
            error: 'User not found'
        });
    }

    if (!(await bcrypt.compare(password, user.password))) {
        return res.status(400).send({
            error: 'Invalid password'
        });
    }

    user.password = undefined;

    res.send({
        user,
        token: generateToken({
            id: user.id
        })
    });
});

router.post('/forgot-password', async (req, res) => {
    const {
        email
    } = req.body;

    try {
        const user = await User.findOne({
            email
        });

        if (!user) {
            return res.status(400).send({
                error: 'User not found'
            });
        }

        console.log('gerar token aleatorio');
        const token = crypto.randomBytes(20).toString('hex');
        console.log(token);

        const now = new Date();
        now.setHours(now.getHours() + 1);
        console.log(token, now);

        await User.findOneAndUpdate(user.id, {
            $set: {
                passwordResetToken: token,
                passwordResetExpires: now
            }
        });

        console.log('Enviar email para: ' + email);

        mailer.sendMail({
                to: email,
                from: 'forgot@gmail.com',
                template: 'forgot_password',
                context: {
                    token
                }
            },
            err => {
                console.log('*************', error);

                if (err) {
                    return res.status(400).send({
                        error: 'Cannot send forgot password email'
                    });
                }
                return res.send();
            }
        )
    } catch (error) {
        console.log(error);

        return res.status(400).send({
            error: 'Error on forgot password, try again'
        });
    }
    return res.send();
});


router.post('/reset-password', async (req, res) => {
    const {
        email,
        token,
        password
    } = req.body;

    try {
        const user = await User.findOne({
                email
            })
            .select('+passwordResetToken passwordResetExpires');

        if (!user) {
            return res.status(400).send({
                error: 'User not found'
            });
        }

        if (token !== user.passwordResetToken) {
            return res.status(400).send({
                error: 'Token invalid'
            });
        }

        const now = new Date();

        if (now > user.passwordResetExpires) {
            return res.status(400).send({
                error: 'Token expired, generate a new one'
            });
        }

        user.password = password;

        await user.save();

        res.send();

    } catch (error) {
        res.status(400).send({
            error: 'Cannot reset password, try again'
        });
    }
});
module.exports = app => app.use('/auth', router);