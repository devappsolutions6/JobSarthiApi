const validator = require('validator');
const passwordValidator = require('password-validator');

// Create a schema for password validation
const passwordSchema = new passwordValidator();
passwordSchema
  .is().min(8)
  .is().max(100)
  .has().uppercase()
  .has().lowercase()
  .has().digits()
  .has().not().spaces();

const validateSignupInput = (firstName, lastName, email, password) => {
    const errors = {};

    // Validate first name
    if (!firstName || !validator.isLength(firstName, { min: 2, max: 50 })) {
        errors.firstName = 'First name must be between 2 and 50 characters';
    }
    if (!validator.isAlpha(firstName.replace(/\s/g, ''))) {
        errors.firstName = 'First name can only contain letters';
    }

    // Validate last name
    if (!lastName || !validator.isLength(lastName, { min: 2, max: 50 })) {
        errors.lastName = 'Last name must be between 2 and 50 characters';
    }
    if (!validator.isAlpha(lastName.replace(/\s/g, ''))) {
        errors.lastName = 'Last name can only contain letters';
    }

    // Validate email
    if (!email || !validator.isEmail(email)) {
        errors.email = 'Please provide a valid email address';
    }

    // Validate password
    if (!password) {
        errors.password = 'Password is required';
    } else if (!passwordSchema.validate(password)) {
        errors.password = 'Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and no spaces';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

module.exports = { validateSignupInput };                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         