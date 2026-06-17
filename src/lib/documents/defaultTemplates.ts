import type { DocumentClause } from "./templateTypes";

/**
 * Cláusulas oficiales de Miami Motors (fallback cuando el tenant aún no tiene
 * plantilla propia en BD). Transcritas de los contratos en papel de la automotora.
 */
export const DEFAULT_CONSIGNACION_CLAUSES: DocumentClause[] = [
  {
    id: "primero",
    title: "PRIMERO",
    body: "El consignante autoriza al consignatario a realizar una inspección básica al vehículo al momento de la celebración de este contrato, incorporando dicho documento como anexo.",
  },
  {
    id: "segundo",
    title: "SEGUNDO",
    body: "Por el presente instrumento, el consignante entrega el vehículo individualizado en este contrato al consignatario, quien lo acepta para su exhibición, publicación y toda otra gestión útil para su venta, las cuales serán de dominio exclusivo del consignatario, quedando prohibida su utilización o gestión por terceros sin consentimiento expreso de la automotora.",
  },
  {
    id: "tercero",
    title: "TERCERO",
    body: "Dada la naturaleza del presente contrato, el consignatario se compromete a mantener el vehículo en igual estado al que se consigne en el anexo “Inspección básica”, salvo el desgaste normal derivado de pruebas de ruta autorizadas.",
  },
  {
    id: "cuarto",
    title: "CUARTO",
    body: "El consignante se compromete a respetar la exclusividad de venta del consignatario durante todo el período de vigencia del contrato, quedando prohibida su publicación o comercialización por cualquier otra persona o entidad distinta a la automotora.",
  },
  {
    id: "quinto",
    title: "QUINTO: Forma de pago",
    body: "En caso de concretarse la venta:\n1. Si la venta es al contado, el pago al consignante se realizará mediante transferencia o depósito dentro de 24 horas a la cuenta acordada.\n2. Si la venta es con financiamiento, el día de la operación se entregará el monto correspondiente al pie abonado por el comprador, y el saldo se pagará dentro de los 10 días hábiles siguientes a la venta, mediante transferencia bancaria.",
  },
  {
    id: "sexto",
    title: "SEXTO",
    body: "El consignante se obliga a suscribir la transferencia de dominio al momento de concretarse la venta, permitiendo que la entidad financiera pueda liberar el pago del saldo precio cuando corresponda.",
  },
  {
    id: "septimo",
    title: "SÉPTIMO",
    body: "El contrato tendrá una duración de 30 días desde su firma, prorrogables automáticamente por períodos iguales, salvo aviso en contrario con al menos 5 días hábiles de anticipación vía correo electrónico o medio de contacto indicado en el contrato.",
  },
  {
    id: "octavo",
    title: "OCTAVO",
    body: "El consignatario solo responderá por daños externos ocasionados por su culpa directa. No será responsable por fallas mecánicas, eléctricas o estructurales propias del vehículo.",
  },
  {
    id: "noveno",
    title: "NOVENO",
    body: "El consignatario no responderá por perjuicios derivados de caso fortuito o fuerza mayor, tales como terremotos, tsunamis, incendios, u otros eventos similares.",
  },
  {
    id: "decimo",
    title: "DÉCIMO",
    body: "El consignante deberá entregar la siguiente documentación al momento de consignar el vehículo:\n• Permiso de circulación vigente\n• Padrón\n• SOAP vigente\n• Revisión técnica vigente\nDichos documentos serán adjuntados como anexo al contrato.",
  },
  {
    id: "undecimo",
    title: "UNDÉCIMO",
    body: "El consignante autoriza la movilización del vehículo para pruebas de ruta, exhibición, traslados internos, lavados y mantenciones básicas necesarias para su comercialización.",
  },
  {
    id: "decimo_segundo",
    title: "DÉCIMO SEGUNDO: Retiro anticipado y multa compensatoria",
    body: "Si el consignante decide retirar el vehículo antes del término del plazo vigente, deberá dar aviso por escrito con al menos 7 días corridos de anticipación al correo electrónico Contreras3g@gmail.com, establecido como canal formal de comunicación.\nEn caso de incumplir dicho aviso previo, deberá pagar una multa compensatoria única de $200.000 (doscientos mil pesos).\nEsta multa incluye y compensa los gastos administrativos, gestión comercial, publicaciones digitales, marketing, limpieza, lavado, mantención básica y cualquier otro costo asociado al período de consignación.\nPara retirar el vehículo, el consignante deberá presentarse personalmente con su cédula de identidad vigente y el contrato de consignación firmado. Sin la presentación de dicho contrato no se hará entrega del vehículo.\nEl pago de la multa será requisito indispensable para proceder a la entrega.",
  },
  {
    id: "decimo_tercero",
    title: "DÉCIMO TERCERO: Prohibición de retiro con gestión comercial o financiera en curso",
    body: "El consignante no podrá retirar el vehículo si este se encuentra con negociación avanzada, reserva formal, promesa de compraventa firmada, pago de pie o aprobación de crédito en curso con una entidad financiera.\nSe entenderá que existe gestión en curso desde el momento en que se haya recibido reserva, pago parcial, firma de documentos o ingreso formal de solicitud de financiamiento.\nEn dicho caso, el consignante deberá respetar la operación hasta su resolución total, no pudiendo desistir unilateralmente.\nEl incumplimiento de esta cláusula facultará al consignatario para exigir los perjuicios ocasionados, sin perjuicio de la multa señalada en la cláusula anterior.",
  },
];

export const DEFAULT_VENTA_CLAUSES: DocumentClause[] = [
  {
    id: "estado",
    title: "1. Estado del vehículo",
    body: "El cliente declara haber revisado el vehículo previamente a la compra y manifiesta su conformidad con el estado general, mecánico, estético y de funcionamiento del mismo al momento de la firma de la presente nota de venta.",
  },
  {
    id: "documentacion",
    title: "2. Documentación del vehículo",
    body: "La automotora declara que el vehículo se entrega con toda su documentación vigente al momento de la entrega, incluyendo permiso de circulación, revisión técnica y padrón, salvo que se indique expresamente lo contrario en la presente nota de venta.",
  },
  {
    id: "transferencia",
    title: "3. Transferencia de dominio",
    body: "Una vez concretada la venta, el vehículo será entregado para su transferencia de dominio a nombre del cliente, quien acepta realizar los trámites correspondientes según la normativa vigente.",
  },
  {
    id: "garantia",
    title: "4. Ausencia de garantía",
    body: "El cliente declara estar en conocimiento y aceptar que el vehículo adquirido corresponde a un vehículo usado, por lo que la automotora no otorga garantía comercial ni mecánica sobre el mismo. La compra se realiza en el estado actual del vehículo, el cual ha sido revisado y aceptado por el comprador.",
  },
  {
    id: "aceptacion",
    title: "5. Aceptación de condiciones",
    body: "Con la firma de la presente nota de venta, el cliente declara haber leído, comprendido y aceptado íntegramente los términos y condiciones aquí establecidos. El comprador declara haber revisado el vehículo y adquirirlo a su entera conformidad, en el estado en que se encuentra, renunciando a cualquier reclamo posterior relacionado con desgaste propio de vehículos usados.",
  },
];
