import { useState, type FormEvent } from "react";
import { localize, type Language } from "../i18n";
import {
  availableTimeSlots,
  today,
  weekdayName,
} from "../utils/game";
import type { GameDraft } from "../utils/game";

type GameFormProps = {
  draft: GameDraft;
  isEditing: boolean;
  language: Language;
  onChange: (draft: GameDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
};

const durationOptions = [45, 60, 75, 90, 105, 120, 135, 150, 165, 180];

function formatDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}

function displayDate(date: string) {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function isoDate(value: string) {
  const [day, month, year] = value.split("/");
  return day && month && year ? `${year}-${month}-${day}` : "";
}

function isValidDisplayDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;

  const [, day, month, year] = match;
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (
    dayNumber < 1 ||
    dayNumber > 31 ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return false;
  }

  const parsedDate = new Date(`${year}-${month}-${day}T12:00:00`);
  return (
    parsedDate.getFullYear() === yearNumber &&
    parsedDate.getMonth() === monthNumber - 1 &&
    parsedDate.getDate() === dayNumber
  );
}

function durationLabel(duration: number, language: Language) {
  if (duration < 60) return language === "pt" ? `${duration} minutos` : `${duration} minutes`;

  const hours = Math.floor(duration / 60);
  const remainingMinutes = duration % 60;
  const hourLabel = language === "pt"
    ? `${hours} ${hours === 1 ? "hora" : "horas"}`
    : `${hours} ${hours === 1 ? "hour" : "hours"}`;

  if (!remainingMinutes) return hourLabel;

  return language === "pt"
    ? `${hourLabel} e ${remainingMinutes} minutos`
    : `${hourLabel} and ${remainingMinutes} minutes`;
}

export function GameForm({
  draft,
  isEditing,
  language,
  onChange,
  onSubmit,
  onCancel,
}: GameFormProps) {
  const text = (value: string) => localize(value, language);
  const [dateInput, setDateInput] = useState(displayDate(draft.date));
  const dateIsValid = isValidDisplayDate(dateInput);
  const dateHasError =
    dateInput.length === 10 && (!dateIsValid || isoDate(dateInput) < today);

  return (
    <form className="game-form" onSubmit={onSubmit}>
      <label className="game-field location-field">
        <span>{text("Local")}</span>
        <input required maxLength={20} placeholder={text("Ex.: Clube Central")} value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })} />
      </label>
      <div className="game-date-row">
        <label className="game-field date-field">
          <span>{text("Data")}</span>
          <input
            required
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
            placeholder={language === "pt" ? "DD/MM/AAAA" : "DD/MM/YYYY"}
            type="text"
            value={dateInput}
            aria-invalid={dateHasError}
            className={dateHasError ? "date-input-invalid" : undefined}
            onChange={(event) => {
              const value = formatDate(event.target.value);
              setDateInput(value);
              onChange({
                ...draft,
                date:
                  isValidDisplayDate(value) && isoDate(value) >= today
                    ? isoDate(value)
                    : "",
              });
            }}
          />
        </label>
        <div className="game-field weekday-field">
          <span>{text("Dia da semana")}</span>
          <output>{weekdayName(draft.date, language === "pt" ? "pt-BR" : "en-GB")}</output>
        </div>
      </div>
      <label className="game-field start-field">
        <span>{text("Horário de início")}</span>
        <select required value={draft.time} onChange={(event) => onChange({ ...draft, time: event.target.value })}>
          <option value="">{text("Selecione...")}</option>
          {availableTimeSlots.map((timeSlot) => <option key={timeSlot} value={timeSlot}>{timeSlot}</option>)}
        </select>
      </label>
      <label className="game-field duration-field">
        <span>{text("Duração (min)")}</span>
        <select className="duration-select-full" required value={draft.duration || ""} onChange={(event) => onChange({ ...draft, duration: +event.target.value })}>
          <option value="">{text("Selecione...")}</option>
          {durationOptions.map((duration) => (
            <option key={duration} value={duration}>{durationLabel(duration, language)}</option>
          ))}
        </select>
        <select aria-label={text("Duração (min)")} className="duration-select-compact" required value={draft.duration || ""} onChange={(event) => onChange({ ...draft, duration: +event.target.value })}>
          <option value="">{text("Selecione...")}</option>
          {durationOptions.map((duration) => (
            <option key={duration} value={duration}>{duration} min</option>
          ))}
        </select>
      </label>
      <label className="game-field cost-field">
        <span>{text("Valor da quadra")}</span>
        <span className="currency-input">
          <input required min="1" max="999" type="number" placeholder={text("Ex.: 120")} value={draft.courtCost || ""} onChange={(event) => onChange({ ...draft, courtCost: +event.target.value })} />
          <select className="currency-select-full" value={draft.currency} onChange={(event) => onChange({ ...draft, currency: event.target.value as GameDraft["currency"] })}>
            <option value="EUR">{text("Euro (€)")}</option>
            <option value="USD">{text("Dólar ($)")}</option>
            <option value="GBP">{text("Libra (£)")}</option>
            <option value="BRL">{text("Real (R$)")}</option>
          </select>
          <select aria-label={text("Moeda")} className="currency-select-compact" value={draft.currency} onChange={(event) => onChange({ ...draft, currency: event.target.value as GameDraft["currency"] })}>
            <option value="EUR">€</option>
            <option value="USD">$</option>
            <option value="GBP">£</option>
            <option value="BRL">R$</option>
          </select>
        </span>
      </label>
      <label className="game-field players-field">
        <span>{text("Máximo de jogadores")}</span>
        <input required min="2" max="999" type="number" placeholder={text("Ex.: 12")} value={draft.maxPlayers || ""} onChange={(event) => onChange({ ...draft, maxPlayers: +event.target.value })} />
      </label>
      <label className="game-field court-field">
        <span>{text("Número da quadra")}</span>
        <input maxLength={20} placeholder={text("Ex.: 3")} value={draft.courtNumber} onChange={(event) => onChange({ ...draft, courtNumber: event.target.value })} />
      </label>
      <label className="game-field payment-field">
        <span>{text("Informações de pagamento")}</span>
        <input required maxLength={20} placeholder={text("Ex.: Pix, PayPal ou conta bancária")} value={draft.paymentInfo} onChange={(event) => onChange({ ...draft, paymentInfo: event.target.value })} />
      </label>
      <label className="game-field disclaimer-field">
        <span>{text("Aviso aos jogadores (opcional)")}</span>
        <input maxLength={20} placeholder={text("Ex.: Chegue 15 minutos antes")} value={draft.disclaimer ?? ""} onChange={(event) => onChange({ ...draft, disclaimer: event.target.value })} />
      </label>
      <div className="game-form-actions">
        <button
          type="button"
          className="session-action-button delete game-form-cancel"
          onClick={onCancel}
        >
          {text("Cancelar")}
        </button>
        <button className="primary submit-game">
          {text(isEditing ? "Salvar alterações" : "Criar jogo")}
        </button>
      </div>
    </form>
  );
}
