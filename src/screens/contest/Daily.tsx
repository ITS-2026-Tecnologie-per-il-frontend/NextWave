import type { Round, Clock, Player, Track } from "../../types/models.ts";
interface DailyProps {
  round: Round;
  clock: Clock;
  revealed: boolean;
  preview: boolean;
  player: Player;
  onVote: (id: string) => void;
  onReveal: () => void;
  onPreview?: () => void;
  onRanks: () => void;
  onProfile?: () => void;
  tracks?: Track[];
  cloud?: boolean;
}
import { catalog } from "../../data/demo/catalog.ts";
import { canPlay, canVote } from "../../domain/contest/contest.ts";
import { Heading } from "../../components/ui/Heading.tsx";
import { Icon } from "../../components/ui/Icon.tsx";
import { SpotifyLink } from "../../components/ui/SpotifyLink.tsx";
export default function Daily({
  round,
  clock,
  revealed,
  preview,
  player,
  onVote,
  onReveal,
  onPreview,
  onRanks,
  onProfile,
  tracks = catalog,
  cloud = false,
}: DailyProps) {
  const empty = cloud && round.ids.length === 0;
  const showReveal = revealed && !empty;
  const left = Math.max(0, 21 * 3600 - clock.seconds);
  const countdown = [
    Math.floor(left / 3600),
    Math.floor(left / 60) % 60,
    left % 60,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
  return (
    <>
      <Heading title="Il tuo daily wave">
        Una nuova selezione, ogni giorno ·{" "}
        {round.day.split("-").reverse().join("/")}
      </Heading>
      {preview && (
        <div className="notice">
          Stai vedendo il reveal di prova.{" "}
          <button className="textbtn" onClick={onPreview}>
            Torna al contest
          </button>
        </div>
      )}
      <section className="hero">
        <img
          src="/images/art.png"
          alt="Onda sonora cromata nei colori del tuo stile"
        />
        <div className="copy">
          <span className="eyebrow">
            {showReveal ? "IL MOMENTO DEL REVEAL" : "ASCOLTA OLTRE IL NOME"}
          </span>
          <h2>
            {showReveal ? (
              <>
                Le voci hanno
                <br />
                finalmente un nome.
              </>
            ) : (
              <>
                Non sai chi è.
                <br />
                Ma sai cosa senti.
              </>
            )}
          </h2>
          <p>
            {empty
              ? "Cinque spazi per nuove voci. La tua selezione apparirà qui quando ci saranno brani approvati per oggi nei generi che ami."
              : revealed
                ? "Scopri tutti gli artisti della tua selezione."
                : "Ascolta ogni brano fino alla fine per sbloccare il successivo. Dopo aver completato la selezione, scegli il tuo preferito."}
          </p>
        </div>
        <div className="countdown">
          <small>
            {empty
              ? "LA TUA PROSSIMA SCOPERTA"
              : revealed
                ? "REVEAL APERTO"
                : "REVEAL ALLE 21:00"}
          </small>
          <strong className={empty ? "waiting-label" : undefined}>
            {empty ? "IN ATTESA" : revealed ? "21:00" : countdown}
          </strong>
        </div>
      </section>
      {empty && (
        <section className="panel daily-empty-notice">
          <div>
            <h3>Stiamo preparando la tua selezione.</h3>
            <p className="hint">
              I brani approvati arriveranno in questi spazi. Nel frattempo puoi
              scegliere i tuoi generi preferiti.
            </p>
          </div>
          <button className="btn secondary small" onClick={onProfile}>
            Modifica i tuoi gusti
          </button>
        </section>
      )}
      {round.vote && (
        <div className="success revealbanner">
          <b>✓ Il tuo voto è su Next Wave.</b>
          <p className="hint">
            Hai scelto il brano{" "}
            {String(round.ids.indexOf(round.vote) + 1).padStart(2, "0")}.
          </p>
        </div>
      )}
      <div className="sectionhead">
        <h2>{showReveal ? "I tuoi artisti di oggi" : "La tua selezione"}</h2>
        <span className="progresslabel">
          {empty
            ? "5 spazi in attesa"
            : `${round.listened.length}/${round.ids.length} completati`}
        </span>
        {showReveal && (
          <button className="textbtn" onClick={onReveal}>
            Rivedi la classifica ↗
          </button>
        )}
      </div>
      <div className="tracks">
        {!empty &&
          round.ids.map((id, index) => {
            const track = tracks.find((item) => item.id === id);
            if (!track) return null;
            const heard = round.listened.includes(id);
            const locked = !canPlay(round, id);
            const playing = player.active === id && player.playing;
            return (
              <article
                key={id}
                className={`track ${playing ? "playing" : ""} ${locked ? "locked" : ""}`}
              >
                <div className={`cover v${index}`}>
                  <span className="number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="play"
                    disabled={locked || player.loading || (cloud && revealed)}
                    aria-label={`${playing ? "Pausa" : "Ascolta"} brano ${index + 1}`}
                    onClick={() => player.play(id)}
                  >
                    <Icon name={playing ? "pause" : "play"} />
                  </button>
                </div>
                <div className="trackmeta">
                  <span>{track.genre}</span>
                  <span className={heard ? "check" : ""}>
                    {heard
                      ? "✓ Completato"
                      : locked
                        ? "Bloccato"
                        : track.isDemo
                          ? "Audio demo"
                          : "Audio del contest"}
                  </span>
                </div>
                <h3>
                  {revealed
                    ? track.title
                    : `Brano ${String(index + 1).padStart(2, "0")}`}
                </h3>
                <p>
                  {revealed ? track.artist : `${track.mood} · ${track.lang}`}
                </p>
                {locked && (
                  <p className="hint">
                    Completa prima il brano {String(index).padStart(2, "0")}.
                  </p>
                )}
                {revealed ? (
                  <SpotifyLink track={track} />
                ) : (
                  <button
                    className={`vote ${round.vote === id ? "chosen" : ""}`}
                    disabled={!canVote(round, revealed)}
                    onClick={() => onVote(id)}
                  >
                    {round.vote === id
                      ? "✓ Il tuo voto"
                      : round.vote
                        ? "Voto concluso"
                        : !round.ids.every((id) => round.listened.includes(id))
                          ? "Completa tutti per votare"
                          : "Vota questo brano"}
                  </button>
                )}
              </article>
            );
          })}
        {cloud &&
          round.ids.length < 5 &&
          Array.from({ length: 5 - round.ids.length }, (_, offset) => {
            const index = round.ids.length + offset;
            return (
              <article
                key={index}
                className="track track-empty"
                aria-label={`Spazio ${index + 1}, in attesa di un brano`}
              >
                <div className={`cover v${index}`} aria-hidden="true">
                  <span className="number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="empty-vinyl" />
                </div>
                <div className="trackmeta">
                  <span>Nuova scoperta</span>
                  <span>In attesa</span>
                </div>
                <h3>Spazio {String(index + 1).padStart(2, "0")}</h3>
                <p>Il prossimo ascolto parte da qui.</p>
                <div className="empty-track-footer">
                  Brano non ancora disponibile
                </div>
              </article>
            );
          })}
      </div>
      <div className="bottomgrid">
        <section className="panel">
          <h3>Un piccolo rito. Nuove grandi scoperte.</h3>
          <div className="steps">
            <div className="step">
              <span className="num">01</span>
              <b>Ascolta fino alla fine</b>Puoi mettere in pausa e riprendere.
            </div>
            <div className="step">
              <span className="num">02</span>
              <b>Segui l’istinto</b>Completa la tua selezione e vota.
            </div>
            <div className="step">
              <span className="num">03</span>
              <b>Torna alle 21</b>Scopri chi ti ha colpito.
            </div>
          </div>
        </section>
        <section className="panel">
          <span className="eyebrow lime">PIÙ SPAZIO A NUOVE VOCI</span>
          <h3>I tuoi gusti. Le loro opportunità.</h3>
          <p className="hint">
            Cinque slot distribuiti in modo equilibrato tra i generi che ami. I
            brani vengono sorteggiati all’interno di ogni genere e gli slot
            extra ruotano nei giorni di partecipazione.
          </p>
          <button className="textbtn" onClick={onRanks}>
            Come funziona il ranking ↗
          </button>
          {!revealed && !cloud && (
            <button className="textbtn" onClick={onPreview}>
              Prova il reveal delle 21:00
            </button>
          )}
        </section>
      </div>
    </>
  );
}
