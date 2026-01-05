const express = require("express");
const router = express.Router();

const warehouseController = require('../../controllers/warehouseController')

// Warehouse routes
router.get('', warehouseController.getAllWarehouses);
router.get('/new', warehouseController.getCreateWarehouse);
router.post('', warehouseController.postCreateWarehouse);
router.get('/:id', warehouseController.getWarehouse);
router.get('/:id/edit', warehouseController.getEditWarehouse);
router.put('/:id', warehouseController.putUpdateWarehouse);
router.delete('/:id', warehouseController.deleteWarehouse);

module.exports = router;
 