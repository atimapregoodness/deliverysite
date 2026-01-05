const express = require("express");
const router = express.Router();

const deliveryController = require('../../controllers/deliveryController')


router.get("/", deliveryController.listDeliveries);

router.get("/create", deliveryController.showCreateForm);
router.post("/create", deliveryController.createDelivery);

router.get("/:id", deliveryController.getDeliveryDetails);


router.post("/:id/update", deliveryController.updateDelivery);
router.post(
  "/:id/update-status",
  deliveryController.updateDeliveryStatus
);
router.post("/:id/add-incident", deliveryController.addIncident);
router.post("/:id/update-location", deliveryController.updateLocation);
router.post("/:id/assign-driver", deliveryController.assignDriver);


router.post("/:id/geocode", deliveryController.geocodeAddresses);
router.post("/:id/mark-delivered", deliveryController.markAsDelivered);
router.post("/:id/cancel", deliveryController.cancelDelivery);


router.post('/:deliveryId/incidents/:incidentIndex/resolve-accident', 
  deliveryController.resolveIncident
)



router.delete(
  '/:deliveryId/incidents/:incidentIndex',
  deliveryController.deleteIncident
);

router.get(
  '/:deliveryId/incidents/:incidentId',
  deliveryController.getIncidentDetails
);


router.delete("/:id", deliveryController.deleteDelivery);


// ADD PAYMENT
router.post("/:deliveryId/payments", deliveryController.addPayment);



// DELETE PAYMENT
router.delete(  
  "/:deliveryId/payments/:index",
  deliveryController.deletePayment
)



module.exports = router;
 