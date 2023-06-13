const {check} = require('express-validator')
exports.systeminfovalidator=[
    check('id')
    .notEmpty()
    .withMessage('User Is Not Given'),
    check('description')
    .notEmpty()
    .withMessage('Please Give Description')
]