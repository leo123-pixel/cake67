import { WEEK_DAY_LABELS, WEEK_DAYS, type StoreHours } from "@/lib/validators/store";

type Props = {
  hours: StoreHours;
  // Raw submitted values after a failed save, keyed like the inputs.
  echoed?: Record<string, unknown>;
  errors: Record<string, string[]>;
};

export function HoursEditor({ hours, echoed, errors }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xl text-olive">Horários</legend>
      {WEEK_DAYS.map((day) => {
        const saved = hours[day];
        const closed = echoed ? echoed[`${day}_closed`] === "on" : saved === null;
        const open = echoed ? String(echoed[`${day}_open`] ?? "") : (saved?.open ?? "10:00");
        const close = echoed ? String(echoed[`${day}_close`] ?? "") : (saved?.close ?? "18:00");
        const error = errors[`hours.${day}.close`] ?? errors[`hours.${day}.open`];

        return (
          <div key={day} className="rounded-xl border border-cocoa/10 bg-white p-3">
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
              <span className="font-medium">{WEEK_DAY_LABELS[day]}</span>
              <label className="flex min-h-11 items-center gap-2 text-sm sm:order-last">
                <input type="checkbox" name={`${day}_closed`} defaultChecked={closed} className="size-5 accent-olive" />
                Fechada
              </label>
              <label className="text-xs text-cocoa-soft">
                Abre
                <input type="time" name={`${day}_open`} defaultValue={open} aria-label={`${WEEK_DAY_LABELS[day]}: abre`} className="field-input" />
              </label>
              <label className="text-xs text-cocoa-soft">
                Fecha
                <input
                  type="time"
                  name={`${day}_close`}
                  defaultValue={close}
                  aria-label={`${WEEK_DAY_LABELS[day]}: fecha`}
                  aria-invalid={Boolean(error)}
                  className="field-input"
                />
              </label>
            </div>
            {error && <p className="mt-1 text-sm text-raspberry">{error[0]}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
