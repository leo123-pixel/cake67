-- Stage 11 · apply AFTER the stage 11 code is deployed: the code before it
-- would print "{taxa_entrega}" literally in the order message.
-- Adds the fee and total line after the subtotal in the saved template, when
-- the template still has the default subtotal line.


update public.settings
set order_whatsapp_template = replace(order_whatsapp_template, 'Subtotal: {subtotal}', E'Subtotal: {subtotal}\n{taxa_entrega}')
where id = 1
  and position('Subtotal: {subtotal}' in order_whatsapp_template) > 0
  and position('{taxa_entrega}' in order_whatsapp_template) = 0;
