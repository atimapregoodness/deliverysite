const express = require("express");
const router = express.Router();

const driverController = require('../../controllers/driverController')



// Driver routes
router.get('', driverController.getAllDrivers);
router.get('/new', driverController.getCreateDriver);
router.post('', driverController.postCreateDriver);
router.get('/:id', driverController.getDriver);
router.get('/:id/edit', driverController.getEditDriver);
router.put('/:id', driverController.putUpdateDriver);
router.delete('/:id', driverController.deleteDriver);

// Additional driver actions
router.post('/:id/update-status', driverController.postUpdateStatus);


module.exports = router;
 