const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/cucaDB', {
    useNewUrlParser: true
});
mongoose.Promise = global.Promise;

module.exports = mongoose;